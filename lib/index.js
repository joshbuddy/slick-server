var _ = require('lodash');
var colors = require('colors');
var path = require('path');
var fs = require('fs-extra');
var expandHomeDir = require('expand-home-dir');

var Manager = require('slick-io');

var packageJson = fs.readJsonSync(path.join(__dirname, '..', 'package.json'));

var Server = function(opts) {
  this.validateInitialized = true;
  this.root = expandHomeDir(opts.root || process.env.SLICK_ROOT || '~/.slick');

  var configPath = this.configPath = path.join(this.root, 'config.json');
  this.interactive = opts.nonInteractive !== true;
}

module.exports = function() {
  var program = require('commander');
  program
    .option('-R, --root <path>', 'Root path')
    .version(packageJson.version);

  program.parse(process.argv);
  var runner = new Server(program.opts());
  runner.run();
}

Server.prototype.run = function() {
  var server = this;

  var handleRunError = function(err) {
    console.error("Error running:", err);
    manager.whenIdle(function() {
      process.exit(1);
    });
  }

  server._validateInitialized();

  var config = fs.readJsonSync(path.join(this.root, 'config.json'));
  var manager = this.manager = new Manager(this.root, config);

  manager.requestPassword((done) => {
    if (process.platform === 'darwin') {
      var execSync = require('child_process').execSync;
      var out = execSync(`osascript ${path.resolve(path.join(__dirname, '..', '..', 'get_password.applescript'))}`);
      var password = out.toString('utf-8').trim();
      done(null, password);
    } else {
      var prompt = require('prompt');
      prompt.start();
      console.log("A password is required to unlock slick")
      prompt.get([
        {
          name: 'password',
          hidden: true
        }
      ], function(err, opts) {
        if (err) return cb(err);
        done(null, opts.password);
      });
    }
  }).configure((setup, done) => {
    done("You must run `slick config' before running `slick server'");
  }).on('fatal', function(error) {
    console.error('got a fatal error', error);
    process.exit(1);
  }).on('warning', function(warning) {
    console.error('got a warning', warning);
  }).whenReady(() => {
    this._runServices(config.services, () => {
      console.log('done');
    });
  });
  manager.start();
}

Server.prototype._validateInitialized = function() {
  var configPath = this.configPath;
  var fail = function() {
    console.error('Cannot find config file at', configPath, '. You may need to run `slick config\' to generate this file.');
    return process.exit(1);
  }

  try {
    if (!fs.statSync(configPath).isFile()) fail();
  } catch (e) {
    if (e.code === 'ENOENT') return fail()
    throw e;
  }
}

Server.prototype._parsePath = function(path) {
  var match = path.match(/^([^:]+):(\/.*)$/);
  if (!match) {
    console.error('path does not match volume:/path, is instead', path);
    return process.exit(1);
  }
  return {name: match[1], path: match[2]};
}

Server.prototype._runServices = function(config, cb) {
  var manager = this.manager;
  console.error('config', config)

  var serviceNames = _.keys(config)

  if (serviceNames.length === 0) return cb('no services configured');

  var runService = (index) => {
    if (index === serviceNames.length) return cb();
    var name = serviceNames[index];
    var serviceConfig = config[name];
    var serviceClass = require(path.join(__dirname, 'services', name));
    console.error('serviceConfig', serviceConfig);

    var service = new serviceClass(manager, serviceConfig);
    console.log(`Running ${name}`);
    service.run(() => {
      runService(index + 1);
    });
  }
  runService(0);
}

