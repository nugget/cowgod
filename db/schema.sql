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

CREATE TABLE users_joins (
	id SERIAL NOT NULL,
	ts timestamp(0) without time zone NOT NULL DEFAULT (current_timestamp at time zone 'utc'),
	user_id varchar NOT NULL REFERENCES users(user_id),
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
	song_id varchar NOT NULL,
	room_id varchar NOT NULL,
	user_id varchar NOT NULL,
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
	user_id varchar,
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
	user_id varchar NOT NULL,
	song_id varchar NOT NULL,
	PRIMARY KEY(id)
);
CREATE TRIGGER onupdate BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE onupdate_changed();

GRANT SELECT,INSERT ON votelog TO bots;
GRANT ALL ON votelog_id_seq TO bots;
