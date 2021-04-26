[![Go](https://github.com/nugget/cowgod/actions/workflows/go.yml/badge.svg?branch=main)](https://github.com/nugget/cowgod/actions/workflows/go.yml)

cowgod Turntable.fm bot
=======================

Nugget's Turntable.fm alter-ego.  This bot has existed in one form or another
for both Turntable.fm as well as Plug.DJ.  Originally written in Node/JS it has
now been ported to Go.  This bot was created for all the shameless DJs who 
hang out in the [Follow the Leader Shamelessly] room on [Turntable.fm].


DJ Bot Commands
---------------

* `/jump up` Jump up to a DJ spot if available
* `/jump down` Go back to the pit
* `/bop` Vote up the current song
* `/lame` Vote down the current song
* `/skip` Skip the currently playing song
* `/snag` Adds the current playing song to the bottom of the current playlist
* `/random <n>` Randomize the top *n* items in the current playlist
* `/search <searchspec>` Search for a song and add the first hit to the top of
  the current playlist.

Admin Bot Commands
------------------
* `/loglevel <level>` Adjust the logging level on the console
* `/available` Set the bot to available status
* `/unavailable` Set the bot to unavailable status
* `/away` Set the bot to away status
* `/version` Report the bot's version and build information

Using
-----

You can build and run this bot locally if you have golang installed.
Alternatively, you can run it via the [Docker image]:

```sh
docker run nugget/cowgod:latest
```

The bot expects to pull its needed configuration from environment variables.
For the TTAPI items, you can use the [Auth Capture Bookmarklet] to find out
what the three values need to be.

* `TTAPI_AUTH` : Your bot's turntable.fm authentication token
* `TTAPI_USER_ID` Your bot's user ID
* `TTAPI_ROOM_ID` Your default room ID
* `COWGOD_LOGLEVEL` The initial loglevel (trace, debug, info, warn, error)

Useful Links
------------

* [ttapi](https://github.com/alaingilbert/ttapi) : New Golang API
* [Turntable-API](https://github.com/alaingilbert/Turntable-API) : Original Node/Javascript API

[Docker image]: https://hub.docker.com/repository/docker/nugget/cowgod/general
[Auth Capture Bookmarklet]: http://alaingilbert.github.io/Turntable-API/bookmarklet.html
[Turntable.fm]: https://turntable.fm/
[Follow the Leader Shamelessly]: https://turntable.fm/follow_the_leader_shamelessly
