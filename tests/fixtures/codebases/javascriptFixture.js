/* eslint-disable */
import { glob } from 'glob';
import { pipeline } from '@xenova/transformers';
import { default as cfgDefault } from '../config/index.js';
import Logger from '../config/Logger.js';
import fs from 'fs/promises';
import path from 'path';

const fooBar = 'bizBaz';

class FixtureClass {
  property1 = 'this is property1';
  property2 = 'this is property2';

  method1(param1, param2){
    return param1 - param2;
  }

  async method2(param1, param2){
    return await new Promise.resolve(param1 + param2);
  }
}

function fixtureFunction(param1='', param2={}){
  return {
    ...param2,
    res: param1
  };
}

async function* async_generator() {
  for (let i = 0; i < 10; i++) {
    yield await new Promise(r => setTimeout(_ => r("hello world"), 100));
  };
}

const fixtureArrow = (param1='') => {
  return param1 + ' addition string stuff';
}

export default FixtureClass;
