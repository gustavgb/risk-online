import { database, getServerTime } from 'api'
import { object } from 'rxfire/database'
import { map, switchMap } from 'rxjs/operators'
import { fromString } from 'utils/makeId'
import { combineLatest } from 'rxjs'
import { countries } from 'constants/countries'
import store from 'store'
import { distribute, removeRandom } from 'utils/cards'

const mapGame = (game) => {
  const timeOffset = store.getState().timeOffset

  return {
    colors: {},
    members: [],
    creator: null,
    title: null,
    id: null,
    initialCountries: [],
    status: {},
    ...game,
    events: (game.events || []).map(event => ({
      ...event,
      timestamp: event.timestamp - timeOffset,
      expire: event.expire - timeOffset
    })),
    displayedCards: {
      list: [],
      ...(game.displayedCards || {})
    },
    countries: (game.countries || []).map(country => ({
      armies: {},
      ...country,
      armiesList: Object.keys(country.armies || {}).map(key => ({
        ...country.armies[key],
        id: key
      }))
    }))
  }
}

const mapHand = (hand) => ({
  cards: [],
  player: null,
  game: null,
  id: null,
  mission: '',
  ...hand
})

export const joinGame = (user, gameId) => {
  let choosenMission = null

  return getServerTime()
    .then(({ data: serverTime }) => store.dispatch({
      type: 'SET_TIME_OFFSET',
      offset: serverTime - Date.now()
    }))
    .then(() => database.ref(`games/${gameId}`).transaction(game => {
      if (game) {
        let changedMembers = false
        if (!game.members) {
          game.members = []
          changedMembers = true
        }

        if (!game.members.find(member => member === user.uid)) {
          game.members.push(user.uid)
          changedMembers = true

          if (!game.missions) {
            game.missions = []
          }

          choosenMission = game.missions.pop()
        }

        if (changedMembers) {
          game.initialCountries = distribute(game.members, countries.map(country => country.name))
        }

        if (!game.initialCountries) {
          game.initialCountries = []
        }

        if (!game.missions) {
          game.missions = {}
        }
      }

      return game
    }))
    .then(() => database.ref(`hands/${gameId}${user.uid}`).transaction(hand => {
      if (!hand) {
        return {
          cards: [],
          player: user.uid,
          game: gameId,
          mission: choosenMission
        }
      }
      return hand
    }))
}

export const streamState = (user, gameId) => {
  const gameRef = database.ref(`games/${gameId}`)
  const boardRef = database.ref(`boards/${gameId}`)
  const handRef = database.ref(`hands/${gameId}${user.uid}`)
  const eventsRef = database.ref(`events/${gameId}`)
  const membersRef = database.ref(`games/${gameId}/members`)

  return combineLatest(
    object(gameRef),
    object(boardRef),
    object(handRef),
    object(eventsRef),
    object(membersRef).pipe(
      switchMap(members => combineLatest(
        ...(members.snapshot.exists() ? members.snapshot.val() : [])
          .map(member => object(database.ref(`users/${member}`)))
      )),
      map(users => users.map(user => ({ ...user.snapshot.val(), id: user.snapshot.key })))
    )
  ).pipe(
    map(([game, board, hand, events, users]) => ({
      game: mapGame({
        ...game.snapshot.val(),
        ...board.snapshot.val(),
        events: events.snapshot.val() || [],
        id: gameId,
        timestamp: Date.now()
      }),
      users,
      hand: mapHand({
        ...hand.snapshot.val(),
        id: gameId + user.uid
      })
    }))
  )
}

export const getUsers = (gameId) => {
  return database.ref(`games/${gameId}`).once('value').then(doc => {
    if (!doc.exists) {
      throw new Error('Document does not exist!')
    }

    const game = doc.val()
    return Promise.all(
      (game.members || []).map(
        member => database.ref(`users/${member}`).once('value').then(user => ({ ...user.val(), id: member }))
      )
    )
  })
}

export const setColors = (gameId, uid, color) => {
  return database.ref(`games/${gameId}`).transaction(game => {
    if (game) {
      if (!game.colors) {
        game.colors = {}
      }

      game.colors = {
        ...game.colors,
        [uid]: color
      }
    }
    return game
  })
}

export const takeCard = (gameId, userId) => {
  const cardType = Math.floor(Math.random() * 3)

  return database.ref(`hands/${gameId}${userId}`).transaction(hand => {
    if (hand) {
      if (!hand.cards) {
        hand.cards = []
      }

      hand.cards.push(cardType)
    }
    return hand
  })
}

export const placeArmy = (gameId, userId, country, color, amount = 1) => {
  return database.ref(`boards/${gameId}`).transaction(board => {
    if (board && color) {
      board.countries = board.countries.map(c => {
        if (country === c.name) {
          const armies = c.armies || {}
          const key = fromString(color)
          const prevAmount = armies[key] ? armies[key].amount : 0

          return {
            ...c,
            armies: {
              ...armies,
              [key]: {
                color,
                amount: prevAmount + amount
              }
            }
          }
        }

        return c
      })
    }
    return board
  })
}

export const removeArmy = (gameId, userId, country, armyId, amount = 1) => {
  return database.ref(`boards/${gameId}`).transaction(board => {
    if (board) {
      if (armyId) {
        board.countries = board.countries.map(c => {
          if (country === c.name) {
            const armies = c.armies || {}
            const prevAmount = armies[armyId] ? armies[armyId].amount : 0

            if (prevAmount - amount > 0) {
              return {
                ...c,
                armies: {
                  ...armies,
                  [armyId]: {
                    ...armies[armyId],
                    amount: prevAmount - amount
                  }
                }
              }
            } else {
              return {
                ...c,
                armies: {
                  ...armies,
                  [armyId]: null
                }
              }
            }
          }

          return c
        })
      }
    }
    return board
  })
}

export const displayCard = (gameId, userId, cardType, cardIndex) => {
  return database.ref(`games/${gameId}`).transaction(game => {
    if (game) {
      if (!game.displayedCards) {
        game.displayedCards = {
          userId
        }
      }

      if (game.displayedCards.userId === userId) {
        if (!game.displayedCards.list) {
          game.displayedCards.list = []
        }
        game.displayedCards.list.push({
          cardType,
          cardIndex
        })
      }
    }

    return game
  })
}

export const removeDisplayedCard = (gameId, userId, cardIndex) => {
  return database.ref(`games/${gameId}`).transaction(game => {
    if (game) {
      if (!game.displayedCards) {
        game.displayedCards = {
          userId,
          list: []
        }
      }

      if (game.displayedCards.userId === userId) {
        if (!game.displayedCards.list) {
          game.displayedCards.list = []
        }
        game.displayedCards.list = game.displayedCards.list.filter(
          card => card.cardIndex !== cardIndex
        )
      }

      if (game.displayedCards.list.length === 0) {
        game.displayedCards = null
      }
    }

    return game
  })
}

export const discardDisplayedCards = (gameId, userId, displayedCards) => {
  return database.ref(`hands/${gameId}${userId}`).transaction(hand => {
    if (hand) {
      if (!hand.cards) {
        hand.cards = []
      }

      hand.cards = hand.cards.filter((card, index) => !displayedCards.find(c => c.cardIndex === index))
    }

    return hand
  })
    .then(() => database.ref(`games/${gameId}`).transaction(game => {
      if (game) {
        if (!game.displayedCards) {
          game.displayedCards = {
            list: []
          }
        }

        if (!game.displayedCards.list) {
          game.displayedCards.list = []
        }

        game.displayedCards.list = game.displayedCards.list.filter(card => !displayedCards.find(c => c.cardIndex === card.cardIndex))

        if (game.displayedCards.list.length === 0) {
          game.displayedCards = null
        }
      }

      return game
    }))
}

export const throwRandomCard = (gameId, userId) => {
  return database.ref(`hands/${gameId}${userId}`).transaction(hand => {
    if (hand) {
      if (!hand.cards) {
        hand.cards = []
      }

      hand.cards = removeRandom(hand.cards)
    }

    return hand
  })
}

export const pushToLog = (gameId, userId, code, content) => {
  const timeOffset = store.getState().timeOffset

  database.ref(`events/${gameId}`).transaction(events => {
    if (!events) {
      events = []
    }

    const now = Date.now() + timeOffset

    events = events.filter(event => event.expire > now)

    events.push({
      timestamp: now,
      expire: now + 7500,
      content,
      code,
      userId
    })

    return events
  })
}

export const connectToPresence = (gameId, uid) => {
  const userStatusRef = database.ref(`games/${gameId}/status/${uid}`)

  database.ref('.info/connected').on('value', function (snapshot) {
    // If we're not currently connected, don't do anything.
    if (snapshot.val() === false) {
      return
    };

    // If we are currently connected, then use the 'onDisconnect()'
    // method to add a set which will only trigger once this
    // client has disconnected by closing the app,
    // losing internet, or any other means.
    userStatusRef.onDisconnect().set(false).then(function () {
      // The promise returned from .onDisconnect().set() will
      // resolve as soon as the server acknowledges the onDisconnect()
      // request, NOT once we've actually disconnected:
      // https://firebase.google.com/docs/reference/js/firebase.database.OnDisconnect

      // We can now safely set ourselves as 'online' knowing that the
      // server will mark us as offline once we lose connection.
      userStatusRef.set(true)
    })
  })

  return () => {
    userStatusRef.onDisconnect().cancel()
    userStatusRef.set(false)
  }
}
