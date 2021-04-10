package main

import (
	"fmt"
	"math/rand"
	"os"
	"regexp"
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
	logrus.WithFields(logrus.Fields{
		"command":   evt.Command,
		"success":   evt.Success,
		"up":        evt.Room.Metadata.Upvotes,
		"down":      evt.Room.Metadata.Downvotes,
		"listeners": evt.Room.Metadata.Listeners,
		"votelog":   evt.Room.Metadata.Votelog,
	}).Info("Vote")
}

func onPmmed(evt ttapi.PmmedEvt) {
	logrus.WithFields(logrus.Fields{
		"userID":   evt.Userid,
		"senderID": evt.SenderID,
		"text":     evt.Text,
	}).Info("Received PM")
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

func pmSimpleCommands(evt ttapi.PmmedEvt) {
	re := regexp.MustCompile(`(?i)^/([^ ]+)$`)
	res := re.FindStringSubmatch(evt.Text)

	fmt.Println("pmSimple", len(res), res)

	if len(res) != 0 {
		command := strings.ToLower(res[1])

		switch command {
		case "skip":
			tt.Bot.Skip()
		case "bop":
			err := tt.Bot.VoteUp()
			if err != nil {
				logrus.WithError(err).Error("Unable to bop")
			}
		case "lame":
			err := tt.Bot.VoteDown()
			if err != nil {
				logrus.WithError(err).Error("Unable to lame")
			}
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

func init() {
	rand.Seed(time.Now().UTC().UnixNano())
	LogLevel(os.Getenv("COWGOD_LOGLEVEL"))
}

func main() {
	auth := os.Getenv("TTAPI_AUTH")
	userID := os.Getenv("TTAPI_USER_ID")
	roomID := os.Getenv("TTAPI_ROOM_ID")

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

	// General Purpose event handlers
	tt.Bot.OnReady(onReady)
	tt.Bot.OnNewSong(onNewSong)
	tt.Bot.OnSpeak(onSpeak)
	tt.Bot.OnUpdateVotes(onUpdateVotes)
	tt.Bot.OnPmmed(onPmmed)

	tt.Bot.Start()
}
