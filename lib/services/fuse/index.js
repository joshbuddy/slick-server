var fuse = require('fuse-bindings')
var fs = require('fs-extra');
var nodePath = require('path');

var MemoryFileHandle = function(volume, contents) {
  this.volume = volume;
  this.contents = new Buffer(contents || '', 'utf8');
  this.time = new Date();
}

MemoryFileHandle.prototype.getattr = function(cb) {
  var entry = this.entry;

  cb(0, {
    mtime: this.time,
    atime: this.time,
    ctime: this.time,
    size: this.contents.length,
    mode: 33188,
    uid: process.getuid(),
    gid: process.getgid()
  });
}

MemoryFileHandle.prototype.slice = function(buf, start, end, cb) {
  this.contents.slice(start, end).copy(buf);
  cb();
}

var FileHandle = function(volume, entry) {
  this.volume = volume;
  this.entry = entry;
}

FileHandle.prototype.getattr = function(cb) {
  var entry = this.entry;

  cb(0, {
    mtime: new Date(entry.mtime),
    atime: new Date(entry.mtime),
    ctime: new Date(entry.ctime),
    size: entry.size,
    mode: entry.mode,
    uid: process.getuid(),
    gid: process.getgid()
  });
}

FileHandle.prototype.slice = function(buf, start, end, cb) {
  this.entry.slice(buf, start, end, cb);
}

var Fuse = module.exports = function(manager, opts) {
  this.manager = manager;
  this.opts = opts;
}

Fuse.prototype.run = function(cb) {
  var fuseService = this;
  var mounts = this.opts.mounts;
  var manager = this.manager;

  var startMount = function(index) {
    if (index === mounts.length) return cb();

    var mount = mounts[index];
    var volumeName = mount.volume;
    fuseService._runVolume(mount.volume, manager.getPath(mount.mountPoint), function(err) {
      if (err && err.isNotFound) {
        console.error('count not find volume for name', volumeName, ', skipping mount');
        return startMount(index + 1);
      }
      if (err) return cb(err);
      startMount(index + 1);
    });
  }

  startMount(0);
}

Fuse.prototype._runVolume = function(volumeName, mountPoint, runCb) {
  var fuseService = this;
  var volume = this.manager.volumes.volume(volumeName);
  var fileHandles = {};
  var createdFiles = {};
  var lastFileHandle = 0;
  var debug = this.opts.debug;

  volume.getVolume(function(err) {
    if (err) return runCb(err);

    fs.ensureDirSync(mountPoint);
    var ops = {}
    ops.force = true
    var iconPath = nodePath.resolve(nodePath.join(__dirname, 'slick.icns'));
    ops.options = [`volname=${volume.name} (slick)`, 'iosize=16777216', `volicon=${iconPath}`, 'rdonly', 'local', "noappledouble", "noapplexattr"]

    // hard coded into the readdir call
    var cachedFiles = {
      '/.ql_disablethumbnails': new MemoryFileHandle(volume),
      '/.ql_disablecache': new MemoryFileHandle(volume),
      '/.metadata_never_index': new MemoryFileHandle(volume)
    }

    ops.readdir = function (path, cb) {
      if (debug) console.log('readdir(%s)', path)
      volume.get(path, function(err, entry) {
        if (err) return cb(err);
        if (!entry) return cb(fuse.ENOENT)
        if (entry.objectType !== 'fo') return cb(fuse.EIO);

        var names = [];
        if (path === '/') {
          names.push('.ql_disablethumbnails');
          names.push('.ql_disablecache');
          names.push('.metadata_never_index');
        }
        entry.entries.each(function(entry, name, next) {
          names.push(name);
          next();
        }, function(err) {
          if (err) return cb(err);
          cb(0, names);
        })
      })
    }

    ops.fgetattr = function(p, fh, cb) {
      if (debug) console.log('fgetattr(%s, %d)', p, fh)
      var handle = fileHandles[fh];
      handle.getattr(cb);
    }

    ops.getattr = function (path, cb) {
      if (cachedFiles[path]) return cachedFiles[path].getattr(cb);
      if (debug) console.log('getattr', path)
      volume.get(path, function(err, entry) {
        if (err) return cb(fuse.EIO);
        if (!entry) return cb(fuse.ENOENT)

        new FileHandle(volume, entry).getattr(cb);
      })
    }

    ops.open = function(path, flags, cb) {
      var openHandle = function(handle) {
        var fh = lastFileHandle++;
        fileHandles[fh] = handle;
        cb(0, fh);
      }

      if (debug) console.log('open(%s, %d)', path, flags)
      if (cachedFiles[path]) return openHandle(cachedFiles[path]);
      volume.get(path, function(err, entry) {
        if (err) return cb(err);
        if (!entry) return cb(fuse.ENOENT);
        openHandle(new FileHandle(volume, entry))
      });
    }

    ops.access = function(path, mdoe, cb) {
      cb(0)
    }

    ops.read = function(p, fd, buf, len, pos, cb) {
      if (debug) console.log('read(%s, %d, %d, %d)', p, fd, len, pos)
      var finished = false;
      var handle = fileHandles[fd];
      handle.slice(buf, pos, pos + len, function(err, buffer) {
        if (err) return cb(fuse.EIO)
        cb(len);
      })
    }

    ops.release = function(path, fd, cb) {
      if (debug) console.log('release(%s, %d)', path, fd)
      delete fileHandles[fd];
      cb(0);
    }

    ops.destroy = function(cb) {
      cb();
      console.log("unmounted, remounting in 1 second")
      setTimeout(function() {
        fuseService._runVolume(volumeName, mountPoint, runCb);
      }, 1000)
    }

    process.on('exit', function() {
      fuse.unmount(mountPoint, function() {
        console.error('exiting');
      })
    })

    process.on('SIGINT', function() {
      fuse.unmount(mountPoint, function() {
        console.error('exiting');
        process.exit(0);
      })
    })

    fuse.mount(mountPoint, ops, function(err) {
      if (err) return runCb(err);
      console.error("Mounted at", mountPoint, err)
      runCb()
    })
  })
}
