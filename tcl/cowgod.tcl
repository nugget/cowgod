package require Tclx
package require Pgtcl

namespace eval ::cowgod {
	proc dbconnect {} {
		if {[info exists ::cowgod::db]} {
			return
		}

		array set dbcred {
			dbname		cowgod
			host		localhost
			user		cowgod
			password	"vmsZ7Hg3Ckf4)6p(NoWC"
		}

		set ::cowgod::db [pg_connect -connlist [array get dbcred]]
		unset -nocomplain dbcred

		if {![info exists ::cowgod::db]} {
			puts "database connection error"
			abort_page
		}
	}

	proc dbdisconnect {} {
		if {[info exists ::cowgod::db]} {
			pg_disconnect $::cowgod::db
			unset -nocomplain ::cowgod::db
		}
	}

	proc href {type id} {
		set base_url "/cowgod"

		switch $type {
			dj - song - play {
				return "${base_url}/$type/$id"
			}
		}

		return "#"
	}

	proc avatar_href {id {type fullfront}} {
		set base_url "/cowgod"
		return "${base_url}/avatars/${type}_[format "%03d" $id].png"
	}

	proc dj_name {id} {
		pg_select $::cowgod::db "SELECT nickname FROM users WHERE user_id = [pg_quote $id]" buf {
			return $buf(nickname)
		}
		return "Unknown DJ"
	}
}

package provide cowgod 1.0
