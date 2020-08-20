const queryString = require('query-string');


const mergeHooks = (pre, next) => {
  const sumKeys = Object.keys({ ...pre , ... next });
  const newHooks = {};
  const passFn = () => true;
  sumKeys.forEach((_) => {
    newHooks[_] = (...p) => {
      const preFn =  pre[_] || passFn;
      const nextFn = next[_] || passFn;
      return preFn(...p) && nextFn(...p);
    };
  });
  return newHooks;
};

window.___XhrProxyInstance = undefined;
export class XhrProxy {
  /**
   * 构造函数
   */
  constructor(params = {}) {
    // 单例模式，多次声明直接合并
    if (window.___XhrProxyInstance) {
      if (params.apiCallback) {
        const lastApiCallback =  window.___XhrProxyInstance.apiCallback;
        window.___XhrProxyInstance.apiCallback = (...p) => {
          lastApiCallback(...p);
          params.apiCallback(...p);
        }
      }
      if (params.beforeHooks) {
        window.___XhrProxyInstance.hooks = mergeHooks(window.___XhrProxyInstance.hooks, params.beforeHooks)
      }

      if (params.afterHooks) {
        window.___XhrProxyInstance.execedHooks = mergeHooks(window.___XhrProxyInstance.execedHooks, params.afterHooks)
      }
    
      return window.___XhrProxyInstance;
    }
    this.XHR = window.XMLHttpRequest;

    this.hooks = params.beforeHooks || {};
    this.execedHooks = params.afterHooks || {};
    this.apiCallback= params.apiCallback;
    this.init();

    window.___XhrProxyInstance  = this;
  }

  /**
   * 初始化 重写xhr对象
   */
  init() {
    let _this = this;

    window.XMLHttpRequest = function () {
      this._xhr = new _this.XHR();
      // 用于记录请求的整个链路路径
      this.__record = {};
      _this.overwrite(this);
    }
  }

  /**
   * 处理重写
   */
  overwrite(proxyXHR) {
    for (let key in proxyXHR._xhr) {
      if (typeof proxyXHR._xhr[key] === 'function') {
        this.overwriteMethod(key, proxyXHR);
        continue;
      }
      this.overwriteAttributes(key, proxyXHR);
    }
  }

  /**
   * 重写方法
   */
  overwriteMethod(key, proxyXHR) {
    let hooks = this.hooks;
    let execedHooks = this.execedHooks;
  
    proxyXHR[key] = (...args) => {
      // 拦截
      if (hooks[key] && (hooks[key].apply(proxyXHR, args) === false)) {
        return;
      }

      // 执行方法本体
      const res = proxyXHR._xhr[key].apply(proxyXHR._xhr, args);

      // 方法本体执行后的钩子
      execedHooks[key] && execedHooks[key].call(proxyXHR._xhr, args, res);
      this.setRecord(proxyXHR, key, args, res);

      return res;
    };
  }

  /**
   * 重写属性
   */
  overwriteAttributes(key, proxyXHR) {
    Object.defineProperty(proxyXHR, key, this.setProperyDescriptor(key, proxyXHR));
  }

  /**
   * 对请求进行记录
   */
  setRecord (proxyXHR, key, args) {
    let record = proxyXHR.__record;
    if (key === 'open') {
      const result = queryString.parseUrl(args[1]);
      // 记录请求的方法
      Object.assign(record, {
        method: args[0],
        url: result.url,
        params: result.query,
      });
    } else if (key === 'send') {
      let body =  args[0];
        try {
          body = JSON.parse(body);
        } catch {}
      // 记录请求的参数
      Object.assign(record, {
        body,
        requestStamp: Date.now(), // 请求发送时间
      });
    } else if (key === 'onreadystatechange') {
      // 记录返回参数
      if (proxyXHR.readyState === 4 && proxyXHR.status === 200) {
        const responsHeadersString = proxyXHR.getAllResponseHeaders();
        const responsHeaders = {};
        responsHeadersString.split('\r\n').filter(Boolean).forEach((_) => {
          const [k, v] = _.split(': ');
          responsHeaders[k] = v;
        });
        let responseData = proxyXHR.responseText;
        try {
          responseData = JSON.parse(responseData);
        } catch {}
        Object.assign(record, {
          responseData,
          responsHeaders,
          responsStamp: Date.now(), // 请求回来的时间
        });
        if (this.apiCallback) {
          this.apiCallback(record);
        }
      }
    } else if (key === 'setRequestHeader') {
      if (!record.requestHeaders) {
        record.requestHeaders = {};
      }
      record.requestHeaders[args[0]] = args[1];
    }
  };

  /**
   * 设置属性的属性描述
   */
  setProperyDescriptor(key, proxyXHR) {
    let obj = Object.create(null);
    let _this = this;

    obj.set = function (val) {
      // 如果不是on打头的属性
      if (!key.startsWith('on')) {
        proxyXHR['__' + key] = val;
        return;
      }

      const fn = function (...args) {
        _this.setRecord(proxyXHR, key, args);
        val.apply(proxyXHR, args);
      };

      if (_this.hooks[key]) {

        this._xhr[key] = function (...args) {
          _this.hooks[key].apply(proxyXHR, args);
          fn(...args);
        };

        return;
      }
      this._xhr[key] = fn;
    };

    obj.get = function () {
      return proxyXHR['__' + key] || this._xhr[key];
    };

    return obj;
  }

  /**
   * 取消监听
   */
  unset() {
    window.XMLHttpRequest = this.XHR;
  }
}