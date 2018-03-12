import { OrderedSet, Map } from 'immutable'
import uuid from 'uuid'

import {
  isEmpty,
  toArray,
  cmpIds,
  toList,
  ModelError
} from './utils'

/**
 * Base class for instances.
 *
 * Holds the common information between on-the-fly instances, created
 * with the below Instance class, and anonymous model instances.
 */
export class BaseInstance {

  constructor( data, model, db ) {
    if( isEmpty( model ) ) {
      throw new ModelError( 'Instance: No model given.' )
    }
    /* if( isEmpty( db ) ) {
     *   throw new ModelError( 'Instance: No DB given.' )
     * }*/
    this.id = data.get( 'id' ) || uuid.v4()
    this._db = db
    this._model = model
    this._type = model.type
    this._initial = data
    this._values = new Map()
    this._setInitialValues( data )
  }

  set( field, value ) {
    this._model.switchOnField( field, {
      attribute: () => {
        this[field] = value
      },
      foreignKey: () => {
        this[field] = value
      },
      manyToMany: () => {
        this[field].add( value )
      }
    })      
    return this
  }

  save( db ) {
    if( !db ) {
      db = this._db
    }
    // TODO: This is a bit silly, surely it could just be this._values?
    db.createOrUpdate({
      ...(this._values.toJS()),
      _type: this._type,
      id: this.id
    })
    return db
  }

  delete() {
    this._db.remove( this._values )
  }

  reset() {
    this._values = this._initial
  }

  getDB() {
    return this._db
  }

  getModel() {
    return this._model
  }

  _setInitialValues( data ) {
    for( const fieldName of this._model.iterFields({ includeReverse: true }) ) {
      let value = data.get( fieldName )
      if( value === undefined ) {
        // TODO: Check for default value.
        if( this._model.fieldIsManyToMany( fieldName ) ) {
          value = new OrderedSet()
        }
        else if( !this._model.fieldIsForeignKey( fieldName ) ) {
          value = ''
        }
      }
      this._values = this._values.set( fieldName, value )
    }
  }

}

/**
 * A convenience class to represent model data.
 *
 * Provides getters/setters to assist in modifying model data locally,
 * then saving to the DB later. Also wraps relationships to make
 * finding local DB instances easier.
 */
export default class Instance extends BaseInstance {
  constructor( ...args ) {
    super( ...args )
    this._model.addAttributesToObject( this )
    this._model.addRelationshipsToObject( this )
  }
}
