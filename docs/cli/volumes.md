slick-volumes(1) -- Manage volumes
==================================

## SYNOPSIS

    slick volumes [list]
    slick volumes create <name>
    slick volumes destroy <name>

## DESCRIPTION

Used to manage volumes within slick.

Running `slick volumes` without a command will list the available volumes by default.
`slick volumes create` can be used to create a new volumes. `slick volumes destroy` will
destroy a volumes with the corresponding name. Names of volumes are restricted to
alphanumerics and the following characters `_.,+=-]+"`.

## DETAILS

Volume state is managed within your local slick root directory. The `slick-volumes` command
allows reading and writing operations to occur to the list of volumes. Volumes names must be unique
without your local slick instance. By default, all volumes have read-write permission by only you.

## SEE ALSO

* slick-permissions(1)
