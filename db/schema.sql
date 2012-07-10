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

CREATE TABLE users (
	user_id varchar NOT NULL,
	added timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	changed timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	nickname varchar NOT NULL,
	password varchar,
	owner boolean NOT NULL DEFAULT FALSE,
	admin boolean NOT NULL DEFAULT FALSE,
	trendsetter boolean NOT NULL DEFAULT FALSE,
	PRIMARY KEY(user_id)
);
GRANT SELECT,INSERT,UPDATE ON users TO bots;
CREATE TRIGGER onupdate BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE onupdate_changed();

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


CREATE OR REPLACE FUNCTION nick(varchar) RETURNS varchar AS $$
	DECLARE
		nick varchar;
	BEGIN
		nick := (SELECT nickname FROM users WHERE user_id = $1 LIMIT 1);
		
		IF nick IS NULL THEN
			nick := $1;
		END IF;

		RETURN nick;
	END;
$$ LANGUAGE plpgsql;

DROP VIEW snaglog_expanded, songlog_expanded, joins_expanded;

CREATE VIEW songlog_expanded AS
	SELECT l.*, nick(l.dj_id) as nickname, s.artist, s.song, s.trip_odometer, age(date_trunc('day',current_timestamp),date_trunc('day',l.ts))::varchar||' ago' as age_text FROM songlog l LEFT JOIN songs s ON s.song_id = l.song_id;

CREATE VIEW snaglog_expanded AS
	SELECT s.ts,s.user_id,nick(s.user_id) as nickname,l.dj_id, nick(l.dj_id) as dj_nickname,l.song_id,l.artist,l.song, age(date_trunc('day',current_timestamp),date_trunc('day',s.ts))::varchar||' ago' as age_text FROM snaglog s LEFT JOIN songlog_expanded l ON s.play_id = l.id;

CREATE VIEW joins_expanded AS
	SELECT *, age(date_trunc('hour',current_timestamp),date_trunc('day',ts))::varchar||' ago' as age_text FROM users_joins;

GRANT SELECT ON snaglog_expanded, songlog_expanded, joins_expanded TO bots;
