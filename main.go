package main

import (
	"errors"
	"fmt"
	"math/rand"
	"os"
	"os/signal"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/nugget/cowgod/lib/tt"

	"github.com/alaingilbert/ttapi"
	"github.com/sirupsen/logrus"
)

const (
	WITH_HEART    = true
	WITHOUT_HEARD = false
)

func RandomDelay(secs int) time.Duration {
	delaySeconds := rand.Intn(secs)
	logrus.WithField("delaySeconds", delaySeconds).Trace("Random delay")

	return time.Duration(delaySeconds) * time.Second
}

func DelayWrapper(maxSecs int, f func()) {
	waitTime := RandomDelay(maxSecs)

	logrus.WithField("waitTime", waitTime).Debug("Scheduling delayed bop")
	time.AfterFunc(waitTime, f)
}

func onReady() {
	logrus.WithFields(logrus.Fields{}).Info("Bot is ready")

	roomInfo, err := tt.Bot.RoomInfo()
	if err != nil {
		logrus.WithError(err).Error("Unable to get RoomInfo")
	} else {
		logrus.WithFields(logrus.Fields{
			"room":      roomInfo.Room.Name,
			"roomID":    roomInfo.Room.Roomid,
			"shortcut":  roomInfo.Room.Shortcut,
			"djs":       roomInfo.Room.Metadata.Djcount,
			"listeners": roomInfo.Room.Metadata.Listeners,
		}).Info("Joined room")

		tt.UpdateModeratorList(roomInfo)
		tt.UpdateUsersList(roomInfo)
	}
}

func onRoomChanged(evt ttapi.RoomInfoRes) {
	logrus.WithFields(logrus.Fields{
		"room":    evt.Room.Name,
		"success": evt.Success,
	}).Info("Room changed")

	tt.UpdateModeratorList(evt)
	tt.UpdateUsersList(evt)
}

func onNewSong(evt ttapi.NewSongEvt) {
	logrus.WithFields(logrus.Fields{
		"command": evt.Command,
		"dj":      evt.Room.Metadata.CurrentSong.Djname,
		"djID":    evt.Room.Metadata.CurrentSong.Djid,
		"song":    evt.Room.Metadata.CurrentSong.Metadata.Song,
		"artist":  evt.Room.Metadata.CurrentSong.Metadata.Artist,
		"success": evt.Success,
	}).Info("New song")

	tt.UpdateModeratorList(evt)

	DelayWrapper(20, tt.Bop)
}

func onSpeak(evt ttapi.SpeakEvt) {
	logrus.WithFields(logrus.Fields{
		"name":   evt.Name,
		"userID": evt.UserID,
		"text":   evt.Text,
	}).Info("Chat message")
}

func onUpdateVotes(evt ttapi.UpdateVotesEvt) {
	userID, vote := tt.UnpackVotelog(evt.Room.Metadata.Votelog)

	logrus.WithFields(logrus.Fields{
		"command":   evt.Command,
		"success":   evt.Success,
		"up":        evt.Room.Metadata.Upvotes,
		"down":      evt.Room.Metadata.Downvotes,
		"listeners": evt.Room.Metadata.Listeners,
		"userID":    userID,
		"vote":      vote,
		"name":      tt.UserNameFromID(userID),
	}).Info("Vote")

}

func onSnagged(evt ttapi.SnaggedEvt) {
	if evt.UserID == tt.Me {
		logrus.Debug("Ignoring self-snag")
		return
	}

	logrus.WithFields(logrus.Fields{
		"userID":  evt.UserID,
		"name":    tt.UserNameFromID(evt.UserID),
		"roomID":  evt.RoomID,
		"command": evt.Command,
	}).Info("User snagged current song")

	AddCurrentSongToPlaylist(WITH_HEART)
}

func onPmmed(evt ttapi.PmmedEvt) {
	logrus.WithFields(logrus.Fields{
		"userID":   evt.Userid,
		"senderID": evt.SenderID,
		"text":     evt.Text,
		"name":     tt.UserNameFromID(evt.SenderID),
	}).Info("Received PM")

	tt.UpdateModeratorList(evt)
}

func onRegistered(evt ttapi.RegisteredEvt) {
	for _, u := range evt.User {
		logrus.WithFields(logrus.Fields{
			"userID": u.ID,
			"name":   u.Name,
			"laptop": u.Laptop,
			"acl":    u.ACL,
			"fans":   u.Fans,
			"points": u.Points,
			"avatar": u.Avatarid,
		}).Info("User joined the room")

		tt.UpdateUser(u.ID, u.Name)
	}
}

func onDeregistered(evt ttapi.DeregisteredEvt) {
	for _, u := range evt.User {
		logrus.WithFields(logrus.Fields{
			"userID": u.ID,
			"name":   u.Name,
			"laptop": u.Laptop,
			"acl":    u.ACL,
			"fans":   u.Fans,
			"points": u.Points,
			"avatar": u.Avatarid,
		}).Info("User left the room")

		tt.UpdateUser(u.ID, u.Name)
	}
}

func rejectUser(userID string) {
	logrus.WithFields(logrus.Fields{
		"senderrID": userID,
		"name":      tt.UserNameFromID(userID),
	}).Warn("Ignoring non-moderator")

	tt.Bot.PM(userID, "Sorry, I will only do that for room moderators.")
}

func pmSay(evt ttapi.PmmedEvt) {
	if !tt.UserIsModerator(evt.SenderID) {
		rejectUser(evt.SenderID)
		return
	}

	re := regexp.MustCompile(`(?i)^/(say) (.*)`)
	res := re.FindStringSubmatch(evt.Text)

	if len(res) != 0 {
		tt.Say(res[2])
	}
}

func pmLogLevel(evt ttapi.PmmedEvt) {
	if !tt.UserIsModerator(evt.SenderID) {
		rejectUser(evt.SenderID)
		return
	}

	re := regexp.MustCompile(`(?i)^/(loglevel) (.*)`)
	res := re.FindStringSubmatch(evt.Text)

	if len(res) != 0 {
		LogLevel(res[2])
	}
}

func pmDJ(evt ttapi.PmmedEvt) {
	if !tt.UserIsModerator(evt.SenderID) {
		rejectUser(evt.SenderID)
		return
	}

	re := regexp.MustCompile(`(?i)^/(jump) (.+)$`)
	res := re.FindStringSubmatch(evt.Text)

	if len(res) == 3 {
		direction := strings.ToLower(res[2])

		switch direction {
		case "up":
			tt.Bot.AddDj()
		case "down":
			tt.Bot.RemDj("")
		}
	}
}

func pmRandom(evt ttapi.PmmedEvt) {
	if !tt.UserIsModerator(evt.SenderID) {
		rejectUser(evt.SenderID)
		return
	}

	re := regexp.MustCompile(`(?i)^/(random) (.+)$`)
	res := re.FindStringSubmatch(evt.Text)

	if len(res) == 3 {
		count, err := strconv.Atoi(res[2])
		if err != nil {
			logrus.WithFields(logrus.Fields{
				"input": res[2],
				"error": err,
			}).Error("Unable to parse number")
			return
		}

		tt.RandomizePlaylist("", count)
	}
}

func addFirstSearchResult(evt ttapi.SearchRes) {
	track := evt.List[0]
	err := tt.Bot.PlaylistAdd(track.ID, "", 0)
	if err != nil {
		logrus.WithError(err).Error("Cannot add to Playlist")
	} else {
		logrus.WithFields(logrus.Fields{
			"song":   track.Metadata.Song,
			"artist": track.Metadata.Artist,
			"ID":     track.ID,
		}).Info("Added track to top of playlist")
		tt.LogPlaylist("", 2)
	}
}

func pmSearch(evt ttapi.PmmedEvt) {
	if !tt.UserIsModerator(evt.SenderID) {
		rejectUser(evt.SenderID)
		return
	}

	re := regexp.MustCompile(`(?i)^/(search) (.+)$`)
	res := re.FindStringSubmatch(evt.Text)

	if len(res) == 3 {
		query := res[2]

		_, err := tt.Bot.Search(query, addFirstSearchResult)
		if err != nil {
			logrus.WithFields(logrus.Fields{
				"query": query,
				"error": err,
			}).Error("Unable to search")
			return
		}
	}
}

func pmAvatar(evt ttapi.PmmedEvt) {
	if !tt.UserIsModerator(evt.SenderID) {
		rejectUser(evt.SenderID)
		return
	}

	re := regexp.MustCompile(`(?i)^/(avatar) (.+)$`)
	res := re.FindStringSubmatch(evt.Text)

	if len(res) == 3 {
		avatar, err := strconv.Atoi(res[2])
		if err != nil {
			logrus.WithFields(logrus.Fields{
				"input": res[2],
				"error": err,
			}).Error("Unable to parse number")
			return
		}

		err = tt.Bot.SetAvatar(avatar)
		if err != nil {
			logrus.WithFields(logrus.Fields{
				"avatar": avatar,
				"error":  err,
			}).Error("Unable to set avatar")
			return
		}
	}
}

func pmSimpleCommands(evt ttapi.PmmedEvt) {
	if !tt.UserIsModerator(evt.SenderID) {
		rejectUser(evt.SenderID)
		return
	}

	re := regexp.MustCompile(`(?i)^/([^ ]+)$`)
	res := re.FindStringSubmatch(evt.Text)

	if len(res) != 0 {
		var err error

		command := strings.ToLower(res[1])

		switch command {
		case "skip":
			err = tt.Bot.Skip()
		case "bop":
			tt.Bop()
		case "lame":
			tt.Lame()
		case "snag":
			err = AddCurrentSongToPlaylist(WITH_HEART)
		case "away":
			err = tt.Bot.SetStatus("away")
		case "available":
			err = tt.Bot.SetStatus("available")
		case "unavailable":
			err = tt.Bot.SetStatus("unavailable")
		case "avatars":
			avatarList()
		case "rejectme":
			rejectUser(evt.SenderID)
		case "version":
			tt.Bot.PM(evt.SenderID, versionInfo())
		}

		if err != nil {
			logrus.WithFields(logrus.Fields{
				"command": command,
				"error":   err,
			}).Error("Error running simple command")
		}
	}
}

func avatarList() {
	moo, err := tt.Bot.UserAvailableAvatars()
	if err != nil {
		logrus.WithError(err).Error("Can't get avatarList")
		return
	}

	fmt.Printf("\n%+v\n", moo)
}

func LogLevel(level string) {
	level = strings.ToLower(level)

	switch level {
	case "trace":
		logrus.SetLevel(logrus.TraceLevel)
	case "debug":
		logrus.SetLevel(logrus.DebugLevel)
	case "warn":
		logrus.SetLevel(logrus.WarnLevel)
	case "error":
		logrus.SetLevel(logrus.ErrorLevel)
	default:
		logrus.SetLevel(logrus.InfoLevel)
	}

	logrus.WithFields(logrus.Fields{
		"level": logrus.GetLevel(),
	}).Info("Set logging level")
}

func MustGetenv(v string) string {
	val := os.Getenv(v)
	if val == "" {
		logrus.WithFields(logrus.Fields{
			"name": v,
		}).Fatal("Mandatory environment variable missing")
	}

	return val
}

func AddCurrentSongToPlaylist(withHeart bool) (err error) {
	playlist, err := tt.CurrentPlaylist()
	if err != nil {
		logrus.WithError(err).Error("Cannot determine current playlist")
		return err
	}

	Songs, err := tt.Bot.PlaylistAll(playlist)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"playlist": playlist,
			"error":    err,
		}).Error("Cannot load playlist")
		return err
	}

	songID := tt.Bot.CurrentSongID

	for idx, Track := range Songs.List {
		if Track.ID == songID {
			logrus.WithFields(logrus.Fields{
				"songID":   songID,
				"playlist": playlist,
				"index":    idx,
				"artist":   Track.Metadata.Artist,
				"song":     Track.Metadata.Song,
			}).Info("Current song is already in playlist")
			return errors.New("already in playlist")
		}
	}

	err = tt.Bot.PlaylistAdd(songID, playlist, len(Songs.List))
	if err != nil {
		logrus.WithError(err).Error("Cannot add to Playlist")
	} else {
		logrus.Info("Added current song to my playlist")

		if withHeart {
			err = tt.Bot.Snag()
			if err != nil {
				logrus.WithError(err).Warn("Could not emote the Snag heart")
			}
		}
	}

	tt.LogPlaylist(playlist, 2)

	return nil
}

func TrapSIGTERM() {
	logrus.Debug("Trapping SIGTERM")
	c := make(chan os.Signal, 2)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-c
		shutdown()
	}()
}

func versionInfo() string {
	t, err := time.ParseInLocation(time.RFC3339, BuildDate, time.UTC)
	if err != nil {
		logrus.WithError(err).Error("Cannot parse BuildDate")
	}
	return fmt.Sprintf("I am cowgod version %s built %s",
		GitSummary,
		t.Format("Mon 2-Jan-2006 @ 15:04 MST"),
	)
}

func shutdown() {
	logrus.Info("Orderly shutdown")
	os.Exit(0)
}

func init() {
	rand.Seed(time.Now().UTC().UnixNano())
	LogLevel(os.Getenv("COWGOD_LOGLEVEL"))
}

func main() {
	TrapSIGTERM()

	logrus.WithFields(logrus.Fields{
		"version":   Version,
		"commit":    GitCommit,
		"branch":    GitBranch,
		"state":     GitState,
		"summary":   GitSummary,
		"builddate": BuildDate,
	}).Info("Obey the cowgod")

	auth := MustGetenv("TTAPI_AUTH")
	userID := MustGetenv("TTAPI_USER_ID")
	roomID := MustGetenv("TTAPI_ROOM_ID")

	logrus.Info("Connecting to turntable.fm")
	err := tt.New(auth, userID, roomID)
	if err != nil {
		logrus.WithError(err).Fatal("Can't initialize new bot")
	}

	// PM command hooks
	tt.Bot.OnPmmed(pmSay)
	tt.Bot.OnPmmed(pmLogLevel)
	tt.Bot.OnPmmed(pmSimpleCommands)
	tt.Bot.OnPmmed(pmDJ)
	tt.Bot.OnPmmed(pmRandom)
	tt.Bot.OnPmmed(pmSearch)
	tt.Bot.OnPmmed(pmAvatar)

	// General Purpose event handlers
	tt.Bot.OnSnagged(onSnagged)
	tt.Bot.OnReady(onReady)
	tt.Bot.OnNewSong(onNewSong)
	tt.Bot.OnSpeak(onSpeak)
	tt.Bot.OnUpdateVotes(onUpdateVotes)
	tt.Bot.OnPmmed(onPmmed)
	tt.Bot.OnRegistered(onRegistered)
	tt.Bot.OnDeregistered(onDeregistered)

	tt.Bot.Start()
}
