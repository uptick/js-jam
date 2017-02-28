import React, {Component} from 'react';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';

import * as modelActions from '../actions';
import DB from '../db';

/**
 *
 */
export default (ComposedComponent, options) => {

  /**
   * Connect the wrapper component to the model state.
   */
  return connect(

    state => {
      const {name, schema} = options || {};
      const {model = {}} = state;
      const db = schema.db( model.db );
      let trans = db.getTransaction( name );
      return {
        db: trans,
        originalDB: db
      };
    },

    dispatch => bindActionCreators( modelActions, dispatch )

  )(

    class TransactionComponent extends Component {

      /**
       * When the component is mounted create the new transaction.
       */
      componentWillMount() {
        const {name} = options || {};
        console.debug( `TransactionComponent: start transaction "${name}".` );
        this.props.startTransaction( name );
      }

      render() {
        const {db} = this.props;
        if( db )
          return <ComposedComponent {...this.props} />;
        else
          return null;
      }
    }
  );
}
