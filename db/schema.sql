-- add a role for each bot which will use this database
CREATE ROLE dbusername WITH LOGIN ENCRYPTED PASSWORD 'password';

CREATE ROLE bots;
GRANT bots TO dbusername;

CREATE OR REPLACE FUNCTION onupdate_changed() RETURNS trigger AS $$
	BEGIN
		NEW.changed := (current_timestamp at time zone 'UTC');
		RETURN NEW;
	END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calc_xp() RETURNS trigger AS $$
	DECLARE
		l RECORD;
		l_calc_xp integer;
		l_previous_total_xp integer;
	BEGIN
		IF NEW.cume_xp IS NULL AND NEW.total_xp IS NULL THEN
			RAISE EXCEPTION 'Row needs to contain cume_xp OR total_xp';
		ELSE
			l_previous_total_xp := COALESCE((SELECT total_xp FROM levels WHERE level < NEW.level ORDER BY level DESC LIMIT 1),0);

			IF NEW.cume_xp IS NULL THEN
				NEW.cume_xp := NEW.total_xp - l_previous_total_xp;
				RAISE DEBUG 'Setting cume_xp to % from total_xp value',NEW.cume_xp;
			ELSEIF NEW.total_xp IS NULL THEN
				NEW.total_xp := NEW.cume_xp + l_previous_total_xp;
				RAISE DEBUG 'Setting total_xp to % from total_xp value',NEW.cume_xp;
			END IF;
		END IF;

		RETURN NEW;
	END;
$$ LANGUAGE plpgsql;

CREATE TABLE levels (
	level integer NOT NULL,
	added timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	changed timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	deleted timestamp(0) without time zone,
	cume_xp integer NOT NULL,
	total_xp integer NOT NULL,
	unlocks varchar,
	PRIMARY KEY(level)
);
GRANT SELECT ON levels TO bots;
CREATE TRIGGER onupdate BEFORE UPDATE ON levels FOR EACH ROW EXECUTE PROCEDURE onupdate_changed();
CREATE TRIGGER levelcalc BEFORE UPDATE OR INSERT ON levels FOR EACH ROW EXECUTE PROCEDURE calc_xp();

CREATE TABLE settings (
	setting_id serial NOT NULL,
	added timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	changed timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	deleted timestamp(0) without time zone,
	enabled boolean NOT NULL DEFAULT TRUE,
	uid varchar,
	key varchar NOT NULL,
	value varchar NOT NULL,
	PRIMARY KEY(setting_id)
);
CREATE TRIGGER onupdate BEFORE UPDATE ON settings FOR EACH ROW EXECUTE PROCEDURE onupdate_changed();
GRANT SELECT ON settings TO bots;

CREATE TABLE globals (
	global_id serial NOT NULL,
	added timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	changed timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	uid varchar NOT NULL,
	key varchar NOT NULL,
	value varchar NOT NULL,
	source varchar,
	PRIMARY KEY(global_id)
);
CREATE TRIGGER onupdate BEFORE UPDATE ON globals FOR EACH ROW EXECUTE PROCEDURE onupdate_changed();
GRANT SELECT,INSERT,UPDATE ON globals TO bots;

CREATE TABLE users (
	user_id serial NOT NULL,
	added timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	changed timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	uid varchar UNIQUE,
	nickname varchar,
	password varchar,
	dj_points integer,
	listen_points integer,
	fans integer,
	avatar varchar,
	curate_points integer,
	owner boolean NOT NULL DEFAULT FALSE,
	admin boolean NOT NULL DEFAULT FALSE,
	trendsetter boolean NOT NULL DEFAULT FALSE,
	ignore boolean NOT NULL DEFAULT FALSE,
	tt_uid varchar UNIQUE,
	tt_nickname varchar,
	tt_points integer,
	tt_avatar integer,
	PRIMARY KEY(user_id)
);
GRANT SELECT,INSERT,UPDATE ON users TO bots;
CREATE UNIQUE INDEX users_plug_uid ON users(uid) WHERE uid IS NOT NULL;
CREATE UNIQUE INDEX users_tt_uid ON users(tt_uid) WHERE tt_uid IS NOT NULL;
CREATE TRIGGER onupdate BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE onupdate_changed();

-- insert into users (added,changed,owner,admin,trendsetter,ignore,tt_uid,tt_nickname,tt_points,tt_avatar) SELECT added,changed,owner,admin,trendsetter,ignore,tt_user_id,tt_nickname,tt_points,tt_avatar FROM tt_users ORDER BY added;
-- update users set uid = '528fc223877b923909b5ff2a', nickname = '-nugget-' where tt_uid = '4e00e4e8a3f75104e10b7359';

CREATE TABLE plug_media (
	media_id varchar NOT NULL,
	added timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	changed timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	author varchar,
	title varchar,
	format varchar,
	cid varchar,
	duration integer,
	PRIMARY KEY(media_id)
);
GRANT SELECT,INSERT,UPDATE ON users TO bots;

CREATE TABLE plays (
	play_id serial NOT NULL,
	start_time timestamp without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	user_id integer NOT NULL REFERENCES users(user_id),
	playlist_id varchar,
	media_id varchar REFERENCES plug_media(media_id),
	song_id varchar REFERENCES tt_songs(song_id),
	leader boolean NOT NULL DEFAULT FALSE,
	site varchar NOT NULL DEFAULT 'plug',
	PRIMARY KEY(play_id)
);
GRANT SELECT,INSERT,UPDATE ON plays TO bots;
CREATE INDEX plays_user_id ON plays(user_id);
CREATE INDEX plays_ts ON plays(start_time);

-- insert into plays (play_id,start_time,user_id,song_id,leader,site) SELECT id,ts,user_id,song_id,leader,'tt' FROM tt_plays_expanded ORDER BY ts;
-- alter sequence plays_play_id_seq restart with 92345;

CREATE TABLE grabs (
	grab_id serial NOT NULL,
	play_id integer NOT NULL REFERENCES plays(play_id) DEFAULT currval('plays_play_id_seq'::regclass),
	ts timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	user_id integer NOT NULL REFERENCES users(user_id),
	site varchar NOT NULL DEFAULT 'plug',
	PRIMARY KEY(grab_id)
);
GRANT SELECT,INSERT,UPDATE ON grabs TO bots;
CREATE INDEX grabs_user_id ON grabs(user_id);

-- insert into grabs (play_id,ts,user_id,site) SELECT play_id,ts,user_id,site FROM tt_snags_expanded ORDER BY ts;

CREATE TABLE ninjas (
	ninja_id serial NOT NULL,
	play_id integer NOT NULL REFERENCES plays(play_id) DEFAULT currval('plays_play_id_seq'::regclass),
	ts timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	user_id integer NOT NULL REFERENCES users(user_id),
	dj_id integer NOT NULL REFERENCES users(user_id),
	leader_id integer NOT NULL REFERENCES users(user_id),
	admission varchar,
	site varchar NOT NULL DEFAULT 'plug',
	PRIMARY KEY(ninja_id)
);
GRANT SELECT,INSERT ON ninjas TO bots;
GRANT ALL ON ninjas_ninja_id_seq TO bots;
CREATE INDEX ninjas_user_id ON ninjas(user_id);

CREATE TABLE chats (
	chat_id serial NOT NULL,
	play_id integer NOT NULL REFERENCES plays(play_id) DEFAULT currval('plays_play_id_seq'::regclass),
	ts timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	user_id integer NOT NULL REFERENCES users(user_id),
	text varchar NOT NULL,
	site varchar NOT NULL DEFAULT 'plug',
	PRIMARY KEY (chat_id)
);
GRANT SELECT,INSERT,UPDATE ON chats TO bots;
CREATE INDEX chats_user_id ON chats(user_id);

-- insert into chats (ts,user_id,play_id,text,site) SELECT ts,user_id,play_id,text,site FROM tt_chats_expanded ORDER BY ts;
-- update chats c set play_id = coalesce((SELECT max(p.play_id) FROM plays p WHERE p.start_time <= c.ts),1) WHERE play_id = 1;

DROP VIEW plays_expanded;
CREATE VIEW plays_expanded AS
	SELECT p.*,coalesce(m.author,s.artist) as author,coalesce(m.title,s.song) as title,m.format,m.duration,coalesce(u.nickname,u.tt_nickname) as nickname,u.uid,(SELECT array_to_string(array_agg(g.user_id),' ') FROM grabs g WHERE g.play_id = p.play_id) as snaggers
	FROM plays p
	LEFT JOIN users u USING (user_id)
	LEFT JOIN plug_media m USING (media_id)
	LEFT JOIN tt_songs s   USING (song_id);
GRANT SELECT ON plays_expanded TO bots;

DROP VIEW chats_expanded;
CREATE VIEW chats_expanded AS
	SELECT c.*,coalesce(u.nickname,u.tt_nickname) as nickname
	FROM chats c
    LEFT JOIN users u USING (user_id);
GRANT SELECT ON chats_expanded TO bots;


CREATE FUNCTION id_from_uid(l_uid varchar) RETURNS integer AS $$
	DECLARE l_user_id integer;
	BEGIN
		SELECT user_id INTO l_user_id FROM users WHERE uid = l_uid OR tt_uid = l_uid ORDER BY uid LIMIT 1;
		RETURN l_user_id;
	END;
$$ LANGUAGE plpgsql;

--
--
-- LEGACY TABLES BELOW
--
--

CREATE TABLE songs (
	song_id varchar NOT NULL,
	added timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	changed timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	artist varchar,
	song varchar,
	album varchar,
	genre varchar,
	length integer,
	mnid varchar,
	coverart varchar,
	md5 varchar,
	labelid integer,
	trip_odometer boolean NOT NULL DEFAULT FALSE,
	PRIMARY KEY(song_id)
);
GRANT SELECT,INSERT ON songs TO bots;
CREATE TRIGGER onupdate BEFORE UPDATE ON songs FOR EACH ROW EXECUTE PROCEDURE onupdate_changed();

CREATE TABLE blacklist (
	user_id varchar NOT NULL,
	added timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	changed timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	added_by varchar,
	enabled boolean NOT NULL DEFAULT TRUE,
	public_msg varchar,
	private_msg varchar,
	PRIMARY KEY(user_id)
);
GRANT SELECT,INSERT,UPDATE ON blacklist TO bots;
CREATE TRIGGER onupdate BEFORE UPDATE ON blacklist FOR EACH ROW EXECUTE PROCEDURE onupdate_changed();

CREATE TABLE users_joins (
	id SERIAL NOT NULL,
	ts timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	user_id varchar NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
	room_id varchar NOT NULL,
	nickname varchar NOT NULL,
	device varchar,
	acl integer,
	fans integer,
	points integer,
	avatarid integer,
	PRIMARY KEY(id)
);
GRANT SELECT,INSERT ON users_joins TO bots;
GRANT ALL ON users_joins_id_seq TO bots;

CREATE TABLE songlog (
	id serial NOT NULL,
	ts timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	song_id varchar NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
	room_id varchar NOT NULL,
	dj_id varchar NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
	stats_djcount integer,
	stats_listeners integer,
	stats_djs varchar,
	PRIMARY KEY(id)
);
GRANT SELECT,INSERT,UPDATE ON songlog TO bots;
GRANT ALL ON songlog_id_seq TO bots;

CREATE TABLE snaglog (
	id serial NOT NULL,
	ts timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	play_id integer NOT NULL REFERENCES songlog(id),
	user_id varchar NOT NULL,
	PRIMARY KEY(id)
);
GRANT SELECT,INSERT ON snaglog TO bots;
GRANT ALL ON snaglog_id_seq TO bots;

CREATE TABLE votelog (
	id serial NOT NULL,
	ts timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	play_id integer NOT NULL REFERENCES songlog(id),
	user_id varchar NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
	vote varchar,
	PRIMARY KEY(id)
);
GRANT SELECT,INSERT ON votelog TO bots;
GRANT ALL ON votelog_id_seq TO bots;

CREATE TABLE queue (
	id serial NOT NULL,
	added timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	changed timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	deleted timestamp(0) without time zone,
	sequence integer NOT NULL,
	user_id varchar NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
	song_id varchar NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
	PRIMARY KEY(id)
);
CREATE TRIGGER onupdate BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE onupdate_changed();

GRANT SELECT,INSERT ON votelog TO bots;
GRANT ALL ON votelog_id_seq TO bots;

CREATE TABLE chat_log (
	id serial NOT NULL,
	ts timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	channel_id varchar NOT NULL DEFAULT '4ec45d23a3f75102da00259c',
	user_id varchar NOT NULL,
	text varchar,
	PRIMARY KEY(id)
);
GRANT SELECT,INSERT ON chat_log TO bots;
GRANT ALL ON chat_log_id_seq TO bots;

CREATE TABLE autoboot (
	id serial NOT NULL,
	added timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	changed timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	deleted timestamp(0) without time zone,
	song_id varchar NOT NULL,
	user_id varchar NOT NULL,
	escort boolean NOT NULL DEFAULT TRUE,
	boot boolean NOT NULL DEFAULT FALSE,
	snark varchar,
	PRIMARY KEY(id)
);
GRANT SELECT,INSERT,UPDATE ON autoboot TO bots;

CREATE TABLE auditlog (
	id serial NOT NULL,
	added timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	user_id varchar NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
	action varchar NOT NULL,
	target_id varchar,
	value varchar,
	comments varchar,
	source varchar,
	PRIMARY KEY(id)
);
GRANT SELECT,INSERT ON auditlog TO bots,cowgod;
GRANT ALL ON auditlog_id_seq TO cowgod;

CREATE OR REPLACE FUNCTION nick(varchar) RETURNS varchar AS $$
	DECLARE
		nick varchar;
	BEGIN
		nick := (SELECT nickname FROM users WHERE uid = $1 LIMIT 1);
		
		IF nick IS NULL THEN
			nick := (SELECT nickname FROM users WHERE tt_uid = $1 LIMIT 1);
		END IF;

		IF nick IS NULL THEN
			nick := $1;
		END IF;

		RETURN nick;
	END;
$$ LANGUAGE plpgsql;


CREATE TABLE roulettelog (
	id serial NOT NULL,
	added timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	rules varchar NOT NULL DEFAULT 'rouletteone',
	user_id varchar NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
	odds integer,
	roll integer,
	PRIMARY KEY(id)
);
GRANT SELECT,INSERT ON roulettelog TO bots;

DROP VIEW tt_plays_expanded;
CREATE VIEW tt_plays_expanded AS
	SELECT l.*, u.user_id,u.tt_nickname, s.artist, s.song, s.length,(l.dj_id=substring(l.stats_djs from 3 for 24))::boolean as leader, 'tt'::varchar as site
	FROM tt_playlog l LEFT JOIN tt_songs s ON s.song_id = l.song_id LEFT JOIN users u ON u.tt_uid = l.dj_id;

DROP VIEW tt_snags_expanded;
CREATE VIEW tt_snags_expanded AS
	SELECT l.*, u.user_id,u.tt_nickname, 'tt'::varchar as site
	FROM tt_snags l LEFT JOIN users u ON u.tt_uid = l.tt_uid;

DROP VIEW tt_chats_expanded;
CREATE VIEW tt_chats_expanded AS
	SELECT l.*, u.user_id,u.tt_nickname, 'tt'::varchar as site, (SELECT max(p.play_id) FROM plays p WHERE p.start_time <= l.ts) AS play_id
	FROM tt_chats l LEFT JOIN users u ON u.tt_uid = l.tt_uid;

DROP VIEW tt_chats_expanded;
CREATE VIEW tt_chats_expanded AS
	SELECT l.*, u.user_id,u.tt_nickname, 'tt'::varchar as site, 1 as play_id
	FROM tt_chats l LEFT JOIN users u ON u.tt_uid = l.tt_uid;


CREATE VIEW joins_expanded AS
	SELECT *, age(date_trunc('hour',current_timestamp),date_trunc('day',ts))::varchar||' ago' as age_text,
	       extract(epoch from current_timestamp at time zone 'utc' - ts)::integer as secs_ago
	FROM users_joins;

CREATE VIEW chatlog_expanded AS
    SELECT c.*, u.live_avatar, u.nickname
	FROM chat_log c LEFT JOIN users u USING (user_id);

CREATE VIEW auditlog_expanded AS
    SELECT a.id,a.added,a.user_id,
	       (SELECT nickname FROM users WHERE users.user_id = a.user_id LIMIT 1) as nickname,
		   a.action, a.target_id,
	       (SELECT nickname FROM users WHERE users.user_id = a.target_id LIMIT 1) as target,
		   a.value,a.comments,a.source
	FROM auditlog a;

GRANT SELECT ON snaglog_expanded, songlog_expanded, joins_expanded,chatlog_expanded,auditlog_expanded TO bots;
