import {OrderedSet} from 'immutable'
import moment from 'moment'

import {isNil, isRecord, isEmpty, makeId, ModelError, toID} from './utils'

export default class Field {

  equals(a, b) {
    return a == b
  }

  includes(a, b) {
    return a.includes ? a.includes(b) : false
  }

  toInternal(value) {
    if (isNil(value))
      return null
    return this._toInternal(value)
  }

  fromInternal(value) {
    if (isNil(value))
      return null
    return this._fromInternal(value)
  }

  _toInternal(value) {
    return value
  }

  _fromInternal(value) {
    return value
  }

  toIndexable(value) {
    return this.fromInternal(value)
  }

  diff(from, to) {
    if (this.equals(from, to))
      return null
    return this._diff(from, to)
  }

  _diff(from, to) {
    return [from, to]
  }

  applyDiff(value, diff, reverse) {
    return diff[reverse ? 0 : 1]
  }

}

class NonTextField extends Field {

  toInternal(value) {
    if (isEmpty(value))
      return null
    return this._toInternal(value)
  }

  fromInternal(value) {
    if (isEmpty(value))
      return null
    return this._fromInternal(value)
  }

}

class BooleanField extends NonTextField {

  _toInternal = value => {
    return [true, 'true', 'TRUE', 1].includes(value)
  }

}

class TimestampField extends NonTextField {

  equals(a, b) {
    if (moment.isMoment(a))
      return a.isSame(b)
    else if (moment.isMoment(b))
      return b.isSame(a)
    return a == b
  }

  _toInternal(value) {
    if (value == 'now')
      return moment()
    return moment(value)
  }

  _fromInternal(value) {
    // TODO: Should be able to remove this.
    if (value == 'now')
      return moment()
    return value.toISOString()
  }

}

class ForeignKeyField extends NonTextField {

  equals(a, b) {
    if (isRecord(a))
      return a.equals(b)
    else if (isRecord(b))
      return b.equals(a)
    return a == b
  }

  _toInternal(value) {
    return makeId(value)
  }

  _fromInternal(value) {
    return isRecord(value) ? value.toJS() : value
  }

  toIndexable(value) {
    value = this.fromInternal(value)
    if (value !== null)
      value = `${value._type}|${value.id}`
    return value
  }

}

class ManyToManyField extends ForeignKeyField {

  equals(a, b) {
    if (OrderedSet.isOrderedSet(a))
      return a.equals(b)
    else if (OrderedSet.isOrderedSet(b))
      return b.equals(a)
    return a == b
  }

  toInternal(value) {
    if (isEmpty(value))
      value = []
    return new OrderedSet(value.map(x => makeId(x)))
  }

  fromInternal(value) {
    if (isEmpty(value))
      return []
    return value.toJS()
  }

  toIndexable(value) {
    throw new ModelError('Cannot index on a many to many field.')
  }

  _diff(from, to) {
    return [from.subtract(to), to.subtract(from)]
  }

  applyDiff(value, diff, reverse) {
    const ii = reverse ? 1 : 0
    const jj = reverse ? 0 : 1
    return value.subtract(diff[ii]).union(diff[jj])
  }

}

let fields = {
  integer: new NonTextField(),
  float: new NonTextField(),
  timestamp: new TimestampField(),
  boolean: new BooleanField(),
  enum: new NonTextField(),
  foreignkey: new ForeignKeyField(),
  manytomany: new ManyToManyField()
}

let unknownField = new Field()

Field.equals = function(type, a, b) {
  const fld = fields[type]
  return fld ? fld.equals(a, b) : unknownField.equals(a, b)
}

Field.includes = function(type, a, b) {
  const fld = fields[type]
  return fld ? fld.includes(a, b) : unknownField.includes(a, b)
}

Field.toInternal = function(type, value) {
  const fld = fields[type]
  return fld ? fld.toInternal(value) : unknownField.toInternal(value)
}

Field.fromInternal = function(type, value) {
  const fld = fields[type]
  return fld ? fld.fromInternal(value) : unknownField.fromInternal(value)
}

Field.toIndexable = function(type, value) {
  const fld = fields[type]
  return fld ? fld.toIndexable(value) : unknownField.toIndexable(value)
}

Field.diff = function(type, from, to) {
  const fld = fields[type]
  return fld ? fld.diff(from, to) : unknownField.diff(from, to)
}

Field.applyDiff = function(type, value, diff, reverse) {
  const fld = fields[type]
  return fld ? fld.applyDiff(value, diff, reverse) : unknownField.applyDiff(value, diff, reverse)
}

Field.toID = function(value) {
  return toID(value)
}

export {
  fields,
  TimestampField,
  BooleanField,
  ForeignKeyField,
  ManyToManyField
}
