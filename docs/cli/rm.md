slick-rm(1) -- Removes an entry from a volume
=============================================

## SYNOPSIS

    slick rm <target>

## DESCRIPTION

Removes the target. This merely unlinks the entry from the folder it resides in and does not guarantee the
underlying blocks are deleted.

Target must be in the format of `volume:/path`.
