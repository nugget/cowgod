[![Go](https://github.com/nugget/cowgod/actions/workflows/go.yml/badge.svg?branch=main)](https://github.com/nugget/cowgod/actions/workflows/go.yml)

cowgod Turntable.fm bot
=======================

Nugget's Turntable.fm alter-ego.  This bot has existed in one form or another
for both Turntable.fm as well as Plug.DJ.  Originally written in Node/JS it has
now been ported to Go.

Universal Bot Commands
----------------------

* `/jump up` Jump up to a DJ spot if available
* `/jump down` Go back to the pit
* `/bop` Vote up the current song
* `/lame` Vote down the current song
* `/skip` Skip the currently playing song
* `/random n` Randomize the top *n* items in the current playlist

Using
-----

You can build and run this bot locally if you have golang installed.
Alternatively, you can run it via docker:

```
docker run nugget/cowgod:latest
```

Useful Links
------------

* [Turntable-API](github.com/alaingilbert/ttapi) : github project
* [Auth Capture Bookmarklet](http://alaingilbert.github.com/Turntable-API/bookmarklet.html) : how to determine your auth token, user id, and room id.
