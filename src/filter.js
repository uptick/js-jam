import {ID} from './utils'

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

  constructor(op, left, right) {
    this._o = op
    this._l = left
    this._r = right
  }

  execute(visitor, options = {}) {
    const op = visitor[this._o]
    if (!op)
      throw new Error(`Visitor does not support operation "${this._o}".`)
    return op.call(visitor, this, this._l, this._r, options)
  }

  and(right) {
    return new Filter('and', this, right)
  }

  or(right) {
    return new Filter('or', this, right)
  }

  toBasic() {
    let visitor = new BasicVisitor()
    return visitor.execute(this)
  }

}

class Visitor {

  not(filter, op, _, options) {
    return op.execute(this, {not: !(options || {}).not})
  }

}

class BasicVisitor extends Visitor {

  execute(filter) {
    return filter.execute(this)
  }

  eq(filter, field, value, options) {
    // TODO: This needs to go elsewhere.
    if (value instanceof ID)
      value = value.id

    if (value === null) {
      field += '__nu'
      value = options.not ? false : true
    }
    else if (options.not)
      field += '__ne'

    return {
      [field]: value
    }
  }

  and(filter, left, right, options) {
    return {
      ...left.execute(this, options),
      ...right.execute(this, options)
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
    return this.table._mapIndices(filter.execute(this, {}))
  }

  eq(filter, field, value, options) {
    if (value === null) { // TODO: Move this
      field = `${field}__isnull`
      value = true
    }
    return this.table._filterIndices({[field]: value}, options)
  }

  ['in'](filter, field, value, options) {
    return this.table._filterIndices({[`${field}__in`]: value, ...options})
  }

  and(filter, left, right, options) {
    if (options.not)
      return left.execute(this, options).union(right.execute(this, options))
    else
      return left.execute(this).intersect(right.execute(this))
  }

  or(filter, left, right, options) {
    if (options.not)
      return left.execute(this, options).intersect(right.execute(this, options))
    else
      return left.execute(this).union(right.execute(this))
  }

}

export default operations

export {
  Filter,
  DBVisitor
}
