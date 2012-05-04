cowgod Turntable.fm bot
=======================

Nugget's Turntable.fm alter-ego.

Getting Started
---------------

* copy settings.js.default to settings.js and edit to taste
* run "npm install ttapi"
* run "npm install pg" (if you want to use a PostgreSQL database)
* mkdir log
* run "node cowgod.js"

Bot Commands
------------

* `/jump up` Jump up to a DJ spot if available
* `/jump down` Go back to the pit
* `/awesome` Vote up the current song
* `/lame` Vote down the current song
* `/autobop (on|off)` Auto-awesome every song played by anyone
* `/mute (on|off)` Squelch all speech to the channel
* `/follow (on|off)` Copy the up-votes of any cool user
* `/snag` Add the currently playing song to the bot's queue
* `/skip` Skip the currently playing song
* `/comehere` Bot will join you in whatever room you're in
* `/random #` Pick any # songs at random and push them to the top of the queue

Useful Links
------------

* [Turntable-API](https://github.com/alaingilbert/Turntable-API) : github project
* [Auth Capture Bookmarklet](http://alaingilbert.github.com/Turntable-API/bookmarklet.html) : how to determine your auth token, user id, and room id.

