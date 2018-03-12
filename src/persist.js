import { Map } from 'immutable'
import { createTransform } from 'redux-persist'

import DB from './db'

const jamTransform = schema => {
  return createTransform(

    (state, key) => {
      try {
        if( key != 'model' || !state.db )
          return state
        return { ...state }
      }
      catch( e ) {
        console.error( e )
        return state
      }
    },

    (state, key) => {
      try {
        if( key != 'model' || !state.db )
          return state
        const db = new DB( state.db, {schema} )
        return {
          ...state,
          db: db.data
        }
      }
      catch( e ) {
        console.error( e )
        return state
      }
    }

  )
}

export default jamTransform
