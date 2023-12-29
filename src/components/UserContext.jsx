import React from 'react'
import { createContext, useState } from 'react'

export const userContext = React.createContext({});


function UserContext({children}) {
    const [data, setData] = useState({"user_id":""});

  return (
    <userContext.Provider value={{data, setData}}>
      {children}
    </userContext.Provider>
  )
}

export default UserContext