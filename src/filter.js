import { Set } from 'immutable'

const operations = {

  not( op ) {
    return new Filter( 'not', op )
  },

  eq( field, value ) {
    return new Filter( 'eq', field, value )
  },

  ['in']( field, value ) {
    return new Filter( 'in', field, value )
  },

  and( left, right ) {
    return new Filter( 'and', left, right )
  },

  or( left, right ) {
    return new Filter( 'or', left, right )
  }

}

class Filter {

  static isFilter( obj ) {
    return obj instanceof Filter
  }

  constructor( op, left, right ) {
    this._o = op
    this._l = left
    this._r = right
  }

  execute( visitor, options ) {
    return visitor[this._o]( this, this._l, this._r, options )
  }

  and( right ) {
    return new Filter( 'and', this, right )
  }

  or( right ) {
    return new Filter( 'or', this, right )
  }

}

class DBVisitor {

  constructor( db, type ) {
    this.db = db
    this.table = db.getTable( type )
  }

  execute( filter ) {
    return this.table._mapIndices( filter.execute( this, {} ) )
  }

  not( filter, op, _, options ) {
    return op.execute( this, {not: !(options || {}).not} )
  }

  eq( filter, field, value, options ) {
    if( value === null ) {  // TODO: Move this
      field = `${field}__isnull`
      value = true
    }
    return this.table._filterIndices({ [field]: value }, options )
  }

  ['in']( filter, field, value, options ) {
    return this.table._filterIndices({ [`${field}__in`]: value, ...options })
  }

  and( filter, left, right, options ) {
    if( options.not )
      return left.execute( this, options ).union( right.execute( this, options ) )
    else
      return left.execute( this ).intersect( right.execute( this ) )
  }
 
  or( filter, left, right, options ) {
    if( options.not )
      return left.execute( this, options ).intersect( right.execute( this, options ) )
    else
      return left.execute( this ).union( right.execute( this ) )
  }

}

export default operations

export {
  Filter,
  DBVisitor
}
