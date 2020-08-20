<h1 align='center'>xhr-proxy</h1>
<p align='center'>
  <a href="https://travis-ci.com/ShanaMaid/xhr-proxy/">
    <img src="https://travis-ci.com/ShanaMaid/xhr-proxy.svg" alt="travis ci badge">
  </a>
  <img src='https://img.shields.io/npm/v/xhr-proxy.svg?style=flat-square' alt="version">
  <img src='https://img.shields.io/npm/l/xhr-proxy.svg' alt="license">
  <img src='http://img.badgesize.io/https://unpkg.com/xhr-proxy/build/index.js?compression=gzip&label=gzip%20size:%20&style=flat-square'>
  <img src='https://img.shields.io/npm/dt/xhr-proxy.svg?style=flat-square' alt="downloads">
  <img src='https://img.shields.io/npm/dm/xhr-proxy.svg?style=flat-square' alt="downloads-month">
</p>

## Install
```
npm install xhr-proxy
```

## How to use ?
```js
import { XhrInterceptor } from 'xhr-proxy';
//  start proxy xhr
const handle = new XhrInterceptor({
  beforeHooks: {
    open: (...p) => {
      console.log('xhr.open params', ...p);
    },
    send: (...p) => {
      console.log('xhr.send params', ...p);
      console.log('xhr.send will stop  executing');
        // hook return false will stop xhr
      return false;
    }
  },
  afterHooks: {},
  apiCallback: (r) => {
    console.log('request message--->', r);
  }
});

// cancel proxy
handle.unset();
```

console.log
```js 
xhr.open params GET /api/v1/query/goods true
xhr.send params {"name":""}

request message--->
 {
  "method": "GET",
  "url": "/api/v1/query/goods",
  "params": {
    name: 'water',
  },
  "requestHeaders": {
    "Accept": "application/json, text/plain, */*",
  },
  "body": null,
  "requestStamp": 1597922785160,
  "responseData": {
    "code": 0,
    "message": "ok",
    "data": null
  },
  "responsHeaders": {
    "content-type": "application/json; charset=UTF-8",
    "date": "Thu, 20 Aug 2020 11:26:25 GMT",
  },
  "responsStamp": 1597922785301
}

```

## Thanks
[hiNISAL](https://github.com/hiNISAL/any-xhr)