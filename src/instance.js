import {Map} from 'immutable';
import uuid from 'uuid';

import {
  isEmpty, toArray, cmpIds, toList,
  ModelError
} from './utils';

export default class Instance {

  constructor( data, model, db ) {

    if( isEmpty( model ) )
      throw new ModelError( 'Instance: No model given.' );
    if( isEmpty( db ) )
      throw new ModelError( 'Instance: No DB given.' );

    this._db = db;
    this._model = model;
    this.id = data.get( 'id' ) || uuid.v4();
    this._type = model.type;
    this._initial = data;
    this._prepareAttributes( data );
    this._prepareRelationships( data );
    this._values = this._initial;
  }

  _prepareAttributes( data ) {
    for( const name of this._model.attributes.keys() ) {
      const attr = this._model.attributes.get( name );
      if( data[name] !== undefined )
        this._initial = this._initial.set( name, data[name] );
      Object.defineProperty( this, name, {
        get: function() {
          return this._values.get( name );
        },
        set: function( x ) {
          this._values = this._values.set( name, x );
        }
      });
    }
  }

  _prepareRelationships( data ) {
    for( const name of this._model.relationships.keys() ) {
      const rel = this._model.relationships.get( name );
      if( rel.get( 'many' ) ) {
        this._initial = this._initial.set( name, data[name] );
        Object.defineProperty( this, name, {
          get: function() {
            return {
              all: () => {
                return this._values.get( name ).map( x =>
                  this._db.getInstance( x )
                );
              },
              add: x => {
                this._values = this._values.updateIn( [name], y =>
                  y.add( this._db.getId( x ) )
                );
              },
              remove: x => {
                this._values = this._values.updateIn( [name], y =>
                  y.remove( this._db.getId( x ) )
                );
              }
            };
          },
          set: function( x ) {
            throw ModelError( 'Cannot directly set many-to-many.' );
          }
        });
      }
      else {
        if( data[name] !== undefined )
          this._initial = this._initial.set( name, data[name] );
        Object.defineProperty( this, name, {
          get: function() {
            return this._values.get( name );
          },
          set: function( x ) {
            this._values.set( name, this._db.getId( x ) )
          }
        });
      }
    }
  }

  save() {
    this._db.createOrUpdate( this._values );
  }

  delete() {
    this._db.remove( this._values );
    /* let id = uuid.v4();
     * this._initial = this._initial.set( 'id', id );
     * this._values = this._values.set( 'id', id );*/
  }

  reset() {
    this._values = this._initial;
  }

  getDB() {
    return this._db;
  }

}
