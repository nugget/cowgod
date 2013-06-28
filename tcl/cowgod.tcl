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
		unset -nocomplain ::dj_name_cache
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

	proc dj_name {user_id} {
		set username "Unknown DJ"

		if {[info exists ::dj_name_cache($user_id)]} {
			set username $::dj_name_cache($user_id)
		} else {
			pg_select $::cowgod::db "SELECT nickname FROM users WHERE user_id = [pg_quote $user_id]" buf {
				set username $buf(nickname)
				set ::dj_name_cache($user_id) $username
			}
		}

		return $username
	}

	proc dj_link {user_id} {
		return "<a href=\"/cowgod/dj/$user_id\">[::cowgod::dj_name $user_id]</a>"
	}

	proc buttonbar {} {
		webout "<p></p>"
		webout [el_open div -class row]
		webout [el_open div -class span12]
		webout "[el_open div -class btn-group]"
		webout "[el_open a -href "/cowgod/"][el_open button -class "btn"][el_oc img -style "height: 1em; vertical-align: text-top;" -src [::cowgod::avatar_href 15 headfront]] The Pit[el_close button][el_close a]"
		foreach {href title} {djstats "DJ Stats" recent "Recent Plays" bagel "CBDIA" peak "Peak Users"} {
			webout "[el_open a -href "/cowgod/$href"][el_open button -class "btn"]$title[el_close button][el_close a]"
		}
		if {[::macnugget::acl_check cowgod_admin]} {
			webout "[el_open a -href "/cowgod/admin/"][el_open button -class "btn btn-warning"]Admin Tools[el_close button][el_close a]"
		}
		webout "[el_close div]"
		webout "[el_open form -class "form-search pull-right" -action "/cowgod/search"]"
		webout "[el_oc input -name "q" -type text -class "search-query" -placeholder "Search"]"
		webout "[el_close form]"
		webout [el_close div]
		webout [el_close div]
	}

}

package provide cowgod 1.0
