# Slick server

This provides a server and cli interface to a Slick filesystem. See https://github.com/joshbuddy/slick

## Example usage

```
$ npm install -g slick-server

$ slick config
> ... walks you through the installation process ...

$ slick volumes create backup
> Volume `backup' created.

$ slick volumes
> backup

$ slick add backup:/ ./README.md
[===========] 0.0s README.md

$ slick ls backup:/
> README.md
```

## Installation

### Manually

You can manually install Slick server using `npm install -g slick-server`.

### Automatically for OSX

If you're on OSX and don't have Nodejs installed, you can install a standalone version of Slick using

```
$ curl -o- https://raw.githubusercontent.com/slick-io/slick/master/install.sh | bash
```

## Usage

Running `slick` by itself will print a list of valid commands. You can get help for an individual command using `slick help <command>`.