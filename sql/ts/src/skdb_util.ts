/* ***************************************************************************/
/* The type used to represent callable external functions. */
/* ***************************************************************************/
export class SKDBCallable<T1, T2> {
  private id: number;

  constructor(id: number) {
    this.id = id;
  }

  getId(): number {
    return this.id;
  }
}

export class ExternalFuns {
  private externalFuns: Array<(obj: any) => any>;

  constructor() {
    this.externalFuns = [];
  }

  register<T1, T2>(f: (obj: T1) => T2): SKDBCallable<T1, T2> {
    if (typeof f != "function") {
      throw new Error("Only function can be registered");
    }
    let funId = this.externalFuns.length;
    this.externalFuns.push(f);
    return new SKDBCallable(funId);
  }

  call(funId: number, jso: object) {
    return this.externalFuns[funId]!(jso);
  }
}

/* ***************************************************************************/
/* Class for query results, extending Array<Record<>> with some common
   selectors and utility functions for ease of use. */
/* ***************************************************************************/
export class SKDBTable extends Array<Record<string, any>> {
  scalarValue(): any | undefined {
    const row = this.firstRow();
    if (row === undefined) {
      return undefined;
    }
    const cols = Object.keys(row);
    if (cols.length < 1) {
      return undefined;
    }
    if (cols.length > 1) {
      throw new Error(
        `Can't extract scalar: query yielded ${cols.length} columns`,
      );
    }
    return row[cols[0]];
  }

  onlyRow(): Record<string, any> {
    if (this.length != 1) {
      throw new Error(`Can't extract only row: got ${this.length} rows`);
    }
    return this[0];
  }

  firstRow(): Record<string, any> | undefined {
    if (this.length < 1) {
      return undefined;
    }
    return this[0];
  }

  lastRow(): Record<string, any> | undefined {
    if (this.length < 1) {
      return undefined;
    }
    return this[this.length - 1];
  }

  onlyColumn(): any[] {
    const row = this.firstRow();
    if (row === undefined) {
      return [];
    }
    const cols = Object.keys(row);
    if (cols.length < 1) {
      return []; // unlikely to have rows but no cols
    }
    if (cols.length > 1) {
      throw new Error("Too many columns");
    }
    const col = cols[0];
    return this.column(col);
  }

  column(col: string): any[] {
    return this.map((row) => {
      if (!row[col]) {
        throw new Error("Missing column: " + col);
      }
      return row[col];
    });
  }
}
