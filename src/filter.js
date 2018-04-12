import {Set} from 'immutable'

import {ID, isEmpty, makeId, negate} from './utils'

const operations = {

  not(op) {
    return new Filter('not', op)
  },

  eq(field, value) {
    return new Filter('eq', field, value)
  },

  ['in'](field, value) {
    return new Filter('in', field, value)
  },

  and(left, right) {
    return new Filter('and', left, right)
  },

  or(left, right) {
    return new Filter('or', left, right)
  }

}

class Filter {

  static isFilter(obj) {
    return obj instanceof Filter
  }

  static toBasic(obj) {
    if (!Filter.isFilter(obj))
      return obj
    return obj.toBasic()
  }

  static toFilter(obj) {
    let op
    if (Number.isInteger(obj))
      op = operations.eq('id', obj)
    else {
      for (const [k, v] of Object.entries(obj)) {
        let newOp = operations.eq(k, v)
        if (!op)
          op = newOp
        else
          op = operations.and(op, newOp)
      }
    }
    return op
  }

  constructor(op, left, right) {
    this._o = op
    this._l = left
    this._r = right
  }

  execute(visitor) {
    const op = visitor[this._o]
    if (!op)
      throw new Error(`Visitor does not support operation "${this._o}".`)
    return op.call(visitor, this, this._l, this._r)
  }

  and(right) {
    return new Filter('and', this, right)
  }

  or(right) {
    return new Filter('or', this, right)
  }

  not() {
    return operations.not(this)
  }

  toBasic() {
    let visitor = new BasicVisitor()
    return visitor.execute(this)
  }

}

class Visitor {

  execute() {
    this.negation = false
  }

  not(filter, op) {
    this.negation = !this.negation
    try {
      return op.execute(this)
    }
    finally {
      this.negation = !this.negation
    }
  }

}

class BasicVisitor extends Visitor {

  execute(filter) {
    super.execute()
    return filter.execute(this)
  }

  eq(filter, field, value) {
    // TODO: This needs to go elsewhere.
    if (value instanceof ID)
      value = value.id

    if (value === null) {
      field += '__nu'
      value = !this.negation
    }
    else if (this.negation)
      field += '__ne'

    return {
      [field]: value
    }
  }

  in(filter, field, value) {
    // TODO: This needs to go elsewhere.
    if (value instanceof ID)
      value = value.id
    return {
      [`${field}_in`]: value
    }
  }

  and(filter, left, right) {
    return {
      ...left.execute(this),
      ...right.execute(this)
    }
  }

}

class DBVisitor extends Visitor {

  constructor(db, type) {
    super()
    this.db = db
    this.table = db.getTable(type)
  }

  execute(filter) {
    super.execute()
    this.indices = null
    return this.table._mapIndices(filter.execute(this))
  }

  /**
   * Used for mapping IDs after a create.
   */
  mapValue(record, fldName, value) {
    if (fldName == 'id')
      return this.db.mapID(record._type, value)
    else if (value) {
      // TODO: Is duck typing the best option?
      const type = value._type
      const id = value.id
      if (!isEmpty(type) && !isEmpty(id))
        return makeId(type, this.db.mapID(type, id))
    }
    return value
  }

  eq(filter, field, value) {
    return this._filter(field, (rec, fldName) => {
      let v = this.mapValue(rec, fldName, value)
      return this.db.getModel(rec._type).equals(fldName, rec[fldName], v)
    })
  }

  ['in'](filter, field, value) {
    return this._filter(field, (rec, fldName) => {
      let v = this.mapValue(rec, fldName, value)
      return this.db.getModel(rec._type).includes(fldName, rec[fldName], v)
    })
  }

  and(filter, left, right) {
    const op = this.negation ? 'union' : 'intersect'
    return left.execute(this)[op](right.execute(this))
  }

  or(filter, left, right) {
    const op = this.negation ? 'intersect' : 'union'
    return left.execute(this)[op](right.execute(this))
  }

  _filter(field, cmp) {
    let idxs = new Set()
    for (let ii = 0; ii < this.table.size(); ++ii) {
      for (const lup of this.db.lookup(this.table.at(ii), field)) {
        if (negate(cmp(...lup), this.negation))
          idxs = idxs.add(ii)
      }
    }
    return idxs
  }

}

export default operations

export {
  Filter,
  DBVisitor
}
