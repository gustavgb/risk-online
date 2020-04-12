import { database } from 'api'
import { list, object } from 'rxfire/database'
import { map } from 'rxjs/operators'
import { countriesDir } from 'constants/countries'
import { generateId } from 'utils/makeId'
import { missions } from 'constants/missions'

export const streamMyGames = (id) => {
  return list(database.ref('games').orderByChild('creator').equalTo(id))
    .pipe(
      map(games => {
        const result = []
        games.forEach(game => result.push(game.snapshot.val()))
        return result
      }),
      map(games => games.sort((a, b) => {
        if (a.title < b.title) {
          return -1
        } else if (a.title > b.title) {
          return 1
        }
        return 0
      }))
    )
}

export const streamUser = (uid) => {
  return object(database.ref(`users/${uid}`)).pipe(
    map(user => ({ ...user.snapshot.val(), uid, id: uid }))
  )
}

export const createGame = (user) => {
  const title = window.prompt('Skriv spillets titel')

  if (!title) {
    return Promise.resolve()
  }

  const id = generateId()

  database.ref(`games/${id}`).set({
    id,
    title,
    creator: user.uid,
    missions
  })
  database.ref(`boards/${id}`).set({
    id,
    countries: Object.keys(countriesDir).reduce((acc, key) => {
      acc[key] = ({
        name: countriesDir[key].name,
        armies: {}
      })
      return acc
    }, {}),
    colors: {},
    events: [],
    display: {
      dice: {},
      cards: {}
    }
  })
}

export const checkCode = (code) => {
  return new Promise((resolve, reject) => {
    database.ref(`games/${code}`).once('value').then(doc => {
      if (doc.exists()) {
        resolve()
      } else {
        reject(new Error('Koden er ikke gyldig'))
      }
    })
  })
}

export const deleteGame = (game) => {
  if (window.confirm('Er du sikker? Det kan ikke laves om.')) {
    return Promise.all([
      database.ref(`games/${game.id}`).remove(),
      database.ref(`boards/${game.id}`).remove(),
      ...(game.members || []).map(member => database.ref(`hands/${game.id}/${member}`).remove())
    ])
  }
}

export const changeTitle = (gameId) => {
  const title = window.prompt('Skriv en ny titel')

  if (!title) {
    return Promise.resolve()
  }

  return database.ref(`games/${gameId}`).update({
    title
  })
}
