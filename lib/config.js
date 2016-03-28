var _ = require('lodash');
var path = require('path');
var fs = require('fs-extra');
var prompt = require('prompt');
var expandHomeDir = require('expand-home-dir');

var Manager = require('slick-io');

var getConfirmedPassword = function(cb) {
  prompt.get([
    {
      name: 'password',
      hidden: true
    },
    {
      name: 'confirmPassword',
      hidden: true
    }
  ], function(err, opts) {
    if (err) return cb(err);
    if (opts.password === opts.confirmPassword) return cb(null, opts.password)

    console.log("Passwords do not match, please try again")
    getConfirmedPassword(cb);
  });
}

var getPassword = function(cb) {
  prompt.get([
    {
      name: 'password',
      hidden: true
    }
  ], function(err, opts) {
    if (err) return cb(err);
    cb(null, opts.password)
  });
}

module.exports = function() {
  var program = require('commander');
  program
    .option('-R, --root <dir>', 'Root directory to use')
    .option('-p, --print-only', 'Only output the existing config')
    .description('Configures slick')

  program.parse(process.argv);
  var runner = new Config(program.opts());
  runner.run();
}

var Config = function(opts) {
  this.root = expandHomeDir(opts.root || process.env.SLICK_ROOT || '~/.slick');
  this.printOnly = opts.printOnly;
}

Config.prototype.run = function() {
  this.rootPath = path.join(this.root, 'root');
  prompt.start();
  if (fs.existsSync(this.rootPath)) {
    this._configureExisting();
  } else {
    this._configureNew();
  }
}

Config.prototype._setupError = function(error) {
  console.log("there was an error setting up: %s", error);
  process.exit(1);
}

Config.prototype._configureExisting = function() {
  console.log("Slick has already been configured, displaying current configuration")

  var doConfigure = function() {
    prompt.get({
      name: 'reconfigure',
      description: 'Would you like to update your configuration?',
      enum: ['yes', 'no', 'y', 'n']
    }, function(err, response) {
      if (err) return config._setupError(err);
      if (response.reconfigure === '') {
        console.log("You must select either yes or no.")
        return doConfigure();
      }

      switch(response.reconfigure[0]) {
        case 'n':
          console.log('Not updating, exiting');
          process.exit(0);
        case 'y':
          config._configureNew()
          break;
        default:
          return config._setupError("unsupported value "+response.reconfigure);
      }
    })
  }

  var config = this;
  var manager = new Manager(this.root);

  manager.configure((setup, done) => {
    assert(false, 'should not be configuring a pre-existing root');
  }).on('fatal', function(error) {
    console.error('got a fatal error', error);
    process.exit(1);
  }).on('warning', function(warning) {
    console.error('got a warning', warning);
  }).requestPassword((done) => {
    getPassword((err, password) => {
      if (err) return done(err);

      config.previousPassword = password
      done(null, password);
    });
  }).whenReady(() => {
    console.log('# Storage'.bold);
    console.log('## Meta'.bold);

    manager.metaStorage.backends.forEach(function(backend) {
      console.log(backend.type, backend.opts);
    })

    console.log('\n## Bulk'.bold);

    manager.bulkStorage.backends.forEach(function(backend) {
      console.log(backend.type, backend.opts);
    })

    if (config.printOnly) return process.exit(0);

    manager.stop();
    doConfigure();
  })
  manager.start();
}

Config.prototype._configureNew = function() {
  var config = this;
  if (config.printOnly) {
    console.log("No configuration exists at", config.root);
    return process.exit(0);
  }

  console.log(`
 _____ _ _     _
|   __| |_|___| |_
|__   | | |  _| '_|
|_____|_|_|___|_,_|

Hello, welcome to Slick!

Slick allows you to create volumes and back them up remotely. In order to use this, we need to specify a storage service to use. You can either use a Slick server or S3.
`) //'
  var doConfigure = function() {
    prompt.get({
      name: 'type',
      description: 'storage type  (acd, s3)',
      enum: ['s3', 'amazon_cloud_drive', 'acd']
    }, function(err, response) {
      if (err) return config._setupError(err);
      if (response.type === '') {
        console.log("You must select either acd or s3.")
        return doConfigure();
      }

      switch(response.type) {
        case 's3':
          return config._configureS3();
        case 'acd':
        case 'amazon_cloud_drive':
          return config._configureAmazonCloudDrive();
        default:
          return config._setupError("unsupported type "+response.type);
      }
    })
  }
  doConfigure();
}

Config.prototype._configureS3 = function() {
  var s3Regions = [
    "us-east-1",
    "us-west-2",
    "us-west-1",
    "eu-west-1",
    "eu-central-1",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-northeast-1",
    "sa-east-1"
  ];
  prompt.get([
    {
      name: 'accessKey',
      description: 'access key'
    },
    {
      name: 'secretKey',
      description: 'secret key',
      hidden: true
    },
    {
      name: 'region',
      enum: s3Regions,
      default: 'us-east-1'
    },
    {
      name: 'bucket'
    }
  ], (err, results) => {
    if (err) return this._setupError(err);
    this._testS3(results, (err) => {
      if (err) {
        console.log("Those settings could not be used to connect, let's try again.")
        return this._configureS3();
      }
      this._setStorageConfiguration('S3', { accessKey: results.accessKey, secretKey: results.secretKey, region: results.region, bucket: results.bucket });
    })
  })
}

Config.prototype._configureAmazonCloudDrive = function() {
  prompt.get([
    {
      name: 'folderName',
      description: 'folder name',
      default: 'slick'
    },
  ], (err, results) => {
    if (err) return config._setupError(err);
    this._setStorageConfiguration('AmazonCloudDrive', { folderName: results.folderName });
  })
}

Config.prototype._testS3 = function(opts, cb) {
  if (this.skipTesting) {
    console.log("Skipping connection testing of s3");
    return cb();
  }
  new AWS.S3({accessKeyId: opts.accessKey, secretAccessKey: opts.secretKey, region: opts.region}).headBucket({Bucket: opts.bucket}, function(err, data) {
    if (err) return cb(err);
    cb();
  });
}

Config.prototype._setStorageConfiguration = function(type, opts) {
  this.storage = { type: type, opts: opts };
  this._configurePassword();
}

Config.prototype._configurePassword = function() {
  var config = this;
  console.log("You can choose to protect your root with a password. This means when your slick server starts, you will need to enter your password.")
  var doConfigure = function() {
    prompt.get({
      name: 'usePassword',
      description: 'Would you like to use a password with slick?',
      enum: ['yes', 'no', 'y', 'n']
    }, function(err, response) {
      if (err) return config._setupError(err);
      if (response.usePassword === '') {
        console.log("You must select either yes or no.")
        return doConfigure();
      }

      switch(response.usePassword[0]) {
        case 'n':
          delete config.password;
          config._writeConfiguration();
          break;
        case 'y':
          getConfirmedPassword(function(err, password) {
            if (err) return config._setupError(err);
            config.password = password;
            config._writeConfiguration();
          })
          break;
        default:
          return config._setupError("unsupported value "+response.usePassword);
      }
    })
  }
  doConfigure();
}

Config.prototype._writeConfiguration = function() {
  var config = this;
  var manager = new Manager(config.root);

  manager.reconfigure((setup, done) => {
    setup.meta.useMemory();
    setup.meta.useDisk({size: 52428800});    // 50mb

    setup.bulk.useMemory();
    setup.bulk.useDisk({size: 10737418240}); // 10gb

    switch(config.storage.type) {
      case 'S3':
        setup.meta.useS3(config.storage.opts);
        setup.bulk.useS3(config.storage.opts);
        break;
      case 'AmazonCloudDrive':
        setup.meta.useAcd(config.storage.opts);
        setup.bulk.useAcd(config.storage.opts);
        break;
      default:
        console.log('Not using any other storage mechanisms');
    }
    if (config.password) {
      setup.setPassword(config.password);
    } else {
      setup.disablePassword();
    }
    done();
  }).on('fatal', (err) => {
    console.error("Fatal error", err);
    process.exit(1)
  }).on('warning', (warn) => {
    console.error("Warning", warn);
  }).requestPassword((done) => {
    if (!config.previousPassword) return config._setupError("attempting to start manager, but no previous password has been entered");
    done(null, config.previousPassword);
  }).whenReady((err) => {
    console.log("Finished configuring root!");

    var configJson = path.join(config.root, 'config.json');
    fs.writeJsonSync(configJson, {
      services: {
        web: {
          host: 'localhost',
          port: 8091
        }
      }
    });
  })
  manager.start();
}
