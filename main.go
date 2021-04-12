package main

import (
	"math/rand"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/nugget/cowgod/lib/tt"

	"github.com/alaingilbert/ttapi"
	"github.com/sirupsen/logrus"
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
	user, err := tt.Bot.GetProfile(userID)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"userID": userID,
			"error":  err,
		}).Error("Can't load user profile")
	}

	logrus.WithFields(logrus.Fields{
		"command":   evt.Command,
		"success":   evt.Success,
		"up":        evt.Room.Metadata.Upvotes,
		"down":      evt.Room.Metadata.Downvotes,
		"listeners": evt.Room.Metadata.Listeners,
		"userID":    userID,
		"vote":      vote,
		"name":      user.Name,
		"points":    user.Points,
		"ACL":       user.ACL,
	}).Info("Vote")

}

func onPmmed(evt ttapi.PmmedEvt) {
	logrus.WithFields(logrus.Fields{
		"userID":   evt.Userid,
		"senderID": evt.SenderID,
		"text":     evt.Text,
	}).Info("Received PM")
}

func onSnagged(evt ttapi.SnaggedEvt) {
	user, err := tt.Bot.GetProfile(evt.UserID)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"userID": evt.UserID,
			"error":  err,
		}).Error("Can't load user profile")
	}

	logrus.WithFields(logrus.Fields{
		"userID":  evt.UserID,
		"user":    user.Name,
		"roomID":  evt.RoomID,
		"command": evt.Command,
	}).Info("User snagged current song")

	if evt.UserID == tt.Me {
		logrus.Debug("Ignoring self-snag")
	} else {
		err = tt.Bot.PlaylistAdd("", "", 0)
		if err != nil {
			logrus.WithError(err).Error("Cannot add to Playlist")
		} else {
			logrus.Info("Added current song to my playlist")

			err = tt.Bot.Snag()
			if err != nil {
				logrus.WithError(err).Warn("Could not emote the Snag heart")
			}
		}
	}
}

func pmSay(evt ttapi.PmmedEvt) {
	re := regexp.MustCompile(`(?i)^/(say) (.*)`)
	res := re.FindStringSubmatch(evt.Text)

	if len(res) != 0 {
		tt.Say(res[2])
	}
}

func pmLogLevel(evt ttapi.PmmedEvt) {
	re := regexp.MustCompile(`(?i)^/(loglevel) (.*)`)
	res := re.FindStringSubmatch(evt.Text)

	if len(res) != 0 {
		LogLevel(res[2])
	}
}

func pmDJ(evt ttapi.PmmedEvt) {
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
		case "away":
			err = tt.Bot.SetStatus("away")
		case "available":
			err = tt.Bot.SetStatus("available")
		case "unavailable":
			err = tt.Bot.SetStatus("unavailable")
		}

		if err != nil {
			logrus.WithFields(logrus.Fields{
				"command": command,
				"error":   err,
			}).Error("Error running simple command")
		}
	}
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

func init() {
	rand.Seed(time.Now().UTC().UnixNano())
	LogLevel(os.Getenv("COWGOD_LOGLEVEL"))
}

func main() {
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

	tt.Bot.Start()
}
