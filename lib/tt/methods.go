package tt

import (
	"math/rand"

	"github.com/alaingilbert/ttapi"
	"github.com/sirupsen/logrus"
)

func UnpackVotelog(votelog [][]string) (string, string) {
	if len(votelog) < 1 {
		logrus.WithField("votelog", votelog).Warn("Cannot parse Votelog")
		return "", ""
	}

	if len(votelog[0]) < 2 {
		logrus.WithField("votelog", votelog).Warn("Cannot parse Votelog")
		return "", ""
	}

	userID := votelog[0][0]
	vote := votelog[0][1]

	return userID, vote
}

func UpdateModeratorList(evt interface{}) {
	source := "unknown"

	switch t := evt.(type) {
	case ttapi.PmmedEvt:
		source = "PmmedEvt"
		Moderators = t.Roomobj.Metadata.ModeratorID
	case ttapi.NewSongEvt:
		source = "NewSongEvt"
		Moderators = t.Room.Metadata.ModeratorID
	case ttapi.NoSongEvt:
		source = "NoSongEvt"
		Moderators = t.Room.Metadata.ModeratorID
	case ttapi.RoomInfoRes:
		source = "RoomInfoRes"
		Moderators = t.Room.Metadata.ModeratorID
	default:
		logrus.Warn("No moderator info in this message type")
		return
	}

	logrus.WithFields(logrus.Fields{
		"source":     source,
		"count":      len(Moderators),
		"moderators": Moderators,
	}).Debug("Updated moderator list")
}

func UpdateUsersList(evt interface{}) {
	source := "unknown"

	switch t := evt.(type) {
	case ttapi.RoomInfoRes:
		source = "RoomInfoRes"
		for _, u := range t.Users {
			Users[u.ID] = u.Name
		}
	default:
		logrus.Warn("No user info in this message type")
		return
	}

	logrus.WithFields(logrus.Fields{
		"source": source,
		"count":  len(Users),
	}).Debug("Updated users list")
}

func UpdateUser(userID, name string) {
	if userID == "" || name == "" {
		logrus.Warn("Ignoring empty UpdateUser request")
		return
	}
	Users[userID] = name
}

func UserIsModerator(userID string) bool {
	for _, u := range Moderators {
		if u == userID {
			return true
		}
	}
	return false
}

func UserIDFromName(name string) string {
	return ""
}

func UserNameFromID(id string) string {
	name, ok := Users[id]
	if ok {
		return name
	} else {
		return "unknown"
	}
}

func Bop() {
	if Bot.CurrentDjID == Me {
		logrus.Debug("Not voting for myself")
		return
	}

	err := Bot.VoteUp()
	if err != nil {
		logrus.WithError(err).Error("Unable to VoteUp")
	}
}

func Lame() {
	if Bot.CurrentDjID == Me {
		logrus.Debug("Not voting for myself")
		return
	}

	err := Bot.VoteDown()
	if err != nil {
		logrus.WithError(err).Error("Unable to VoteDown")
	}
}

func Say(text string) {
	err := Bot.Speak(text)
	if err != nil {
		logrus.WithError(err).Error("Can't speak")
	}
}

func Skip() {
	err := Bot.StopSong()
	if err != nil {
		logrus.WithError(err).Error("Can't skip")
	}
}

func CurrentPlaylist() (string, error) {
	playLists, err := Bot.PlaylistListAll()
	if err != nil {
		logrus.WithError(err).Error("Cannot load playlists")
		return "", err
	}

	for i, l := range playLists.List {
		if l.Active {
			logrus.WithFields(logrus.Fields{
				"index":    i,
				"playlist": l.Name,
			}).Debug("Using active list")

			return l.Name, nil
		}
	}

	logrus.Warn("Unable to detect current playlist")
	return "default", nil
}

func RandomizePlaylist(name string, count int) (err error) {
	if name == "" {
		name, err = CurrentPlaylist()
		if err != nil {
			return err
		}
	}

	Songs, err := Bot.PlaylistAll(name)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"name":  name,
			"error": err,
		}).Error("Cannot load playlist")
		return err
	}

	// fmt.Printf("\n%+v\n", Songs)

	queueLen := len(Songs.List)

	logrus.WithFields(logrus.Fields{
		"count": queueLen,
		"name":  name,
	}).Debug("Loaded playlist")

	indexTo := 0
	for i := 0; i < count; i++ {
		indexFrom := rand.Intn(queueLen)

		err := Bot.PlaylistReorder(name, indexFrom, indexTo)
		if err != nil {
			logrus.WithFields(logrus.Fields{
				"name":  name,
				"error": err,
			}).Error("Cannot load playlist")
			return err
		} else {
			logrus.WithFields(logrus.Fields{
				"indexFrom": indexFrom,
				"indexTo":   indexTo,
			}).Debug("Relocated song in playlist")
		}
	}

	logrus.WithFields(logrus.Fields{
		"count": count,
		"name":  name,
	}).Info("Randomized Playlist")

	LogPlaylist(name, count)

	return nil
}

func LogPlaylist(name string, count int) error {
	Songs, err := Bot.PlaylistAll(name)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"name":  name,
			"error": err,
		}).Error("Cannot load playlist")
		return err
	}

	if count == 0 {
		count = len(Songs.List)
	}

	for i := 0; i < count; i++ {
		Track := Songs.List[i]
		logrus.WithFields(logrus.Fields{
			"playlist": name,
			"index":    i,
			"song":     Track.Metadata.Song,
			"artist":   Track.Metadata.Artist,
			"length":   Track.Metadata.Length,
		}).Info("Playlist Item")
	}

	return nil
}

func RememberUser(name, userID string) {
}
