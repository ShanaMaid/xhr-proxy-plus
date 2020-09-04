export type Record = {
  body: Object | null,
  method: string,
  params: Object,
  pageUrl: string,
  requestHeaders: {
    [i: string]: string,
  },
  requestStamp: number,
  responsHeaders: {
    [i: string]: string,
  },
  responseStamp: number,
  costTime: number,
  responseData: Object | string,
  url: string,
}

export class XhrProxy {
  /**
   * 构造函数
   */
  constructor(params?: {
    beforeHooks?: { [i: string]: (...p: any) => (boolean | void) },
    afterHooks?: { [i: string]: (...p: any) => (boolean | void) },
    apiCallback?: (r: Record) => void,
  });
  /**
   * 取消监听
   */
  unset(): void;
}
