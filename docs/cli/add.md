slick-add(1) -- Add files to a volume
=====================================

## SYNOPSIS

    slick add [destination] [source] <otherSources...> [-c | --conflict <rename,skip,replace>]

## DESCRIPTION

Adds files to a destination.

Destination must be in the format of `volume:/path`. Globs are accepted for sources.

If a file exists with the same path a conflict resolution mode will be used. Rename will append a
unique extension of the format `.number` to the destination. Skip will by pass any files with the same name.
Replace will update in place the conflicting file. Adding is atomic, and no entries will be persisted until the command
completes.

## OPTIONS

-c --conflict
  Selects the conflict resolution mode, uses rename by default
