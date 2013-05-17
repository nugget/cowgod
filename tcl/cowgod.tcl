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
}

package provide cowgod 1.0
