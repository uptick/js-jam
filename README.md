# redux-jam

[![npm version](https://badge.fury.io/js/redux-jam.svg)](http://badge.fury.io/js/redux-jam)
![Downloads](http://img.shields.io/npm/dm/redux-jam.svg?style=flat)

`redux-jam` is a framework for managing the complexity of multiple data
sources with different fetching and storage characteristics, while using
standard, flexible, and known systems, such as Redux.

Storing data fetched from a server locally is a very attractive method of
improving user experience, but it comes with significant difficulties.
Deciding when to invalidate a locally cached dataset, and how to combine
remote and local data can be a source of immense complexity. This is
especially true when building an application designed for offline
capabilities.

## Installation

```bash
npm install redux-jam
```

or

```bash
yarn add redux-jam
```

Add the JAM model reducer to your root reducer:

```js
import {reducer as model} from 'redux-jam'

const rootReducer = combineReducers({
  model,
  ...
})

export default rootReducer
```


## Defining a Schema

Before data can be manipulated a schema describing the structure of the data
must be defined. There are a number of ways to do it, the two most common are
to define the data manually, or import it automatically using an external
package.

### Manual Definition

Schemas are built using the `Schema` class:

```js
import {Schema} from 'redux-jam'

let schema = new Schema()
```

To define models in a schema, use the `merge` method, which accepts an object
argument describing a part of a schema:

```python
schema.merge({})
```

`merge` may be called any number of times. Each subsequent call will overwrite
any overlapping models.

The structure of the schema object is similar in some ways to the structure of
a JSON-API object. Take for example the following definition of a movie:

```js
{
  movie: {
    attributes: {
      name: {
        required: true        
      },
      duration: {},
      year: {}
    },
    relationships: {
      actors: {
        type: "person",
        many: true,
        relatedName: "actedIn"
      }
    }
    api: {
      list: () => {},
      detail: () => {},
      create: () => {},
      update: () => {},
      delete: () => {}
    }
  },
  person: {
    attributes: {
      name: {
        required: true
      }
    },
    api: {
      list: () => {},
      detail: () => {},
      create: () => {},
      update: () => {},
      delete: () => {}
    }
  }
}
```

This defines two models: `movie` and `person`. The `api` sections of each
model are placeholders for calls to API endpoints. They should return promises,
which in turn return JSON-API structured data.

Options for attributes are currently limited to `required`.

Options for relationships:

 * type

 * required

 * many

 * relatedName

### Django + DRF

If you're using Django and DRF, your schema can be loaded into JAM
automatically, which is particularly convenient.

Refer to [Django-JAM](https://github.com/ABASystems/django-jam)

## Loading Data

Fetching data from the server is achieved with a higher order comonent,
`withView`. Views collect a set of one or more queries and provide the
resultant data to a React component.

The following snippet shows a React component that loads movies whose
title contains the term "Rocky", and sorts them on year:

```js
import React from 'react'
import {withView} from 'redux-jam'
import schema from 'models'

const view = schema.view({
  name: 'movieList',
  queries: {
    movies: {
      type: 'movie',
      filter: F.contains('title', 'Rocky'),
      sort: 'year'
    }
  }
})

@withView(view)
class MoviesList extends React.Component {
  render() {
    const {moviesList} = this.props
    const {loading, queries} = moviesList
    if (!loading) {
      return (
        <ul>
          {queries.movies.map(m => <li>{m.title}</li>}
        </ul>
      )
    }
    else
      return null
  }
}
```

## Mutating data

`redux-jam` provides a form like interface for mutating data.

```js
import React from 'react'
import {withForm} from 'redux-jam'
import schema from 'models'

@withForm({type: 'movie'})
class MoviesList extends React.Component {
  render() {
    const {renderField} = this.props
    // TODO
  }
}
```

## Filtering



## Transactions
