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
		if {$id eq ""} {
			set id 1
		}
		return "${base_url}/avatars/${type}_[format "%03d" $id].png"
	}

	proc dj_name {id} {
		pg_select $::cowgod::db "SELECT nickname FROM users WHERE user_id = [pg_quote $id]" buf {
			return $buf(nickname)
		}
		return "Unknown DJ"
	}

	proc buttonbar {} {
		webout [el_open div -class row]
		webout [el_open div -class span12]
		webout "[el_open div -class btn-group]"
		webout "[el_open button -class "btn"]<a href=\"/cowgod/\">[el_oc img -style "height: 1em;" -src [::cowgod::avatar_href 15 headfront]]</a>[el_close button]"
		foreach {href title} {djstats "DJ Stats" recent "Recent Plays" bagel "CBDIA"} {
			webout "[el_open button -class "btn"]<a href=\"$href\">$title</a></button>"
		}
		webout "[el_close div]"
		webout "[el_open form -class "navbar-search pull-right" -action "/cowgod/search"]"
		webout "[el_oc input -name "q" -type text -class "search-query" -placeholder "Search"]"
		webout "[el_close form]"
		webout [el_close div]
		webout [el_close div]
	}
}

package provide cowgod 1.0
