import { auth, database } from 'api'
import store from 'store'

let loading = false

const defaultUser = {
  email: null,
  name: null,
  games: []
}

auth.onAuthStateChanged(function (user) {
  if (!loading) {
    console.log('Automatic auth state update')
    store.dispatch({
      type: 'LOGIN',
      user
    })
  }
})

export const register = (name, email, password) => {
  loading = true
  return auth.createUserWithEmailAndPassword(email, password)
    .then(user => {
      return database.ref('users/' + user.uid).set({
        ...defaultUser,
        email,
        name
      })
        .then(() => {
          loading = false
          store.dispatch({
            type: 'REGISTER',
            user
          })
        })
    })
}

export const login = (email, password) => {
  loading = true

  return auth.signInWithEmailAndPassword(email, password)
    .then(credential => {
      const user = credential.user
      const ref = database.ref('users/' + user.uid)
      return ref.once('value')
        .then(doc => {
          if (!doc.exists()) {
            return ref.set({
              ...defaultUser,
              email,
              name: email
            })
          }
        })
        .then(() => {
          loading = false
          store.dispatch({
            type: 'LOGIN',
            user
          })
        })
    })
}

export const logout = (email, password) => {
  return auth.signOut()
    .then(() => store.dispatch({
      type: 'LOGOUT'
    }))
}
