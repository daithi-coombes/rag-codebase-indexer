export default class Logger {
  isCli = false;

  // TODO: pass in boolean isCli from ./index.mjs
  constructor() {
    this.env = process.env.NODE_ENV;

    if (this.env!=='test') {
      this.isCli = true;
    }
  }

  consoleLog(str='') {
    if (this.isCli) {
      console.log(str);
    }
  }

  error(str='', err) {
    const message = `\n❌ Error: ${str}`;
    if (err) {
      console.log(err);
    }

    if (this.isCli) {
      this.consoleLog(message);
    } else {
      throw message;
    }
  }

  info(str='') {
    this.consoleLog(str);
  }

  stdOut(str='') {
    if (this.isCli) {
      process.stdout.write(`\r${str}`);
    }
  }

  warn(msg) {
    console.log(`Warning: ${msg}`);
  }
}
