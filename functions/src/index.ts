import * as v2 from "firebase-functions/v2"
//import * as logger from "firebase-functions/logger";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore, Timestamp } from "firebase-admin/firestore"
import createError from "http-errors"
import { IUser } from "./typing";


initializeApp({
    credential: applicationDefault()
})


// intialize the cloud firestore service
const DB = getFirestore()

// sign user in with email and password
export const signinwithemailandpassword = v2.https.onRequest(async (request: v2.https.Request, response) => {
    try {
        const { email, password } = request.body as { email: string; password: string }
        const { tokenId } = request.query as { tokenId: string }
 
        if(!tokenId) throw createError(404, "Not found")
        if(!email || !password) throw createError(404, "Not found")
        const userRecord = await getAuth().getUserByEmail(email)
        if(!userRecord) throw createError(404, "User not found")
        const isValid = await getAuth().verifyIdToken(userRecord.uid)
        if(!isValid) response.status(200).json({ success: false, message: "Invalid token" })
        // sign in the user with email and password
        response.status(200).json({ success: true, message: "User signed in successfully" })
    } catch (error) {
        throw createError(400, "something went wrong")
    }
})

// sign user up with custom token
export const signUpwithCustomtoken = v2.https.onRequest(async (request: v2.https.Request, response) => {
    try {
        const { id, admin } = request.body as { id: string; admin: boolean }
        if(!id) throw createError(401, "unauthorized")
        // first create a custom token for the client 
        const customToken = await getAuth().createCustomToken(id, { admin })
        response.status(200).json({ success: true, token: customToken })
    } catch (error) {
        throw createError(404, `something went wrong ${error}`)
    }
})

// sign user up with email and username
export const signupwithemailandusername = v2.https.onRequest(async (request, response) => {
    try {
        const { email, password } = request.body as { email: string; password: string }
        if(!email || !password) throw createError(404, "Not found")
        const userRecord = await getAuth().createUser({
            email: email,
            password: password,
        })
        if(!userRecord) response.status(200).json({ success: false, message: "user not created"})
        response.status(200).json({ success: true, message: "user created successfully" })
    } catch (error) {
        throw createError(400, "something went wrong")
    }
})

// retrieve multiple users
export const users = v2.https.onRequest( async (request: v2.https.Request, response) => {
    try {
        response.status(200).send("Hello world, working very fine")
    } catch (error) {
       throw createError(404, "Something went wrong")
    }
})

// retrieve single user
export const retriveUser = v2.https.onRequest(async (request: v2.https.Request, response) =>{
     try {
        // grab the user id as a parameter from Url
        const { id } = request.params as { id: string }
        if(!id) throw createError(401, "unauthorized")
        // retrieve user by id
        const userInfo = await getAuth().getUser(id)
        // if user is not existed it means the user is not authenticated yet
        if(!userInfo) throw createError(405,"unauthenticated")
        const user: IUser<string> = {
                      "username": `${userInfo.displayName}`,
                      "userId": userInfo.uid,
                      "email": `${userInfo.email}`,
                      "password": userInfo.passwordHash
                     }
        // if user is authenticated display the user information
        response.status(200).json(user)
     } catch (error) {
        throw createError(404, `something went wrong : ${error}`)
     }
})

// retrieve a single user by email
export const retrieveuserbyemail = v2.https.onRequest(async (request: v2.https.Request, response) => {
    try {
        const { email } = request.body as { email: string}
        // if user is authenticated
        if(!email) throw createError(401, "unauthorized")
        const userInfo = await getAuth().getUserByEmail(email)
        // as user is authenticated display his/her data
        const user:  IUser<string> = {
                      "username": `${userInfo.displayName}`,
                      "userId": userInfo.uid,
                      "email": `${userInfo.email}`,
                      "password": userInfo.passwordHash
                     }
        response.status(200).json(user)
    } catch (error) {
        throw createError(404, `something went wrong ${error}`)
    }
})

// retrieve update a user by id
export const updateuserbyid = v2.https.onRequest(async (request: v2.https.Request, response) => {
    try {
        const { id } = request.params as { id: string }
        const {phoneNumber, emailVerified} = request.body as {phoneNumber: string, emailVerified: boolean}
        // if user is not authenticated
        if(!id) throw createError(401, "unauthorized")
        // if user is authenticated
        const user = await getAuth().updateUser(id, {phoneNumber, emailVerified})
        response.status(200).json({success: true, message: `user ${user.displayName} updated successfully`})
    } catch (error) {
        throw createError(404, `something went wrong : ${error}`)
    }
})

// delete user by id 
export const deleteuserbyid = v2.https.onRequest(async (request: v2.https.Request, response) => {
    try {
        const { id } = request.params as { id: string }
        if(!id) throw createError(401, "unauthorized")
        // delete the corresponding user
        await getAuth().deleteUser(id)
        response.status(200).json({status: true, message: "user is deleted with success"})
    } catch (error) {
        throw createError(404, `something went wrong ${error}`)
    }
})

// retrieve a book by title and user id
export const retrieveBookBytitleAndUserid = v2.https.onRequest(async (request: v2.https.Request, response) => {
    try {
        const { title, id } = request.body as {title: string, id: string}
        if(!title || !id) throw createError(401, "unauthorized")
        // retrieve the book by title and user id
        const book = await DB.collection("books").where("title", "==", title).where("user.id", "==", id).get()
        if(book.empty) throw createError(404, "book not found")
        const books = book.docs.map((doc) => ({id: doc.id, ...doc.data()}))
        response.status(200).json(books)
    } catch (error) {
        throw createError(404, `something went wrong ${error}`)
    }
})

// retrieve books by id and date greater than the given one
export const retrieveBookbyid = v2.https.onRequest(async (request: v2.https.Request, response) => {
    try {
        const { id } = request.params as { id: string }
        if(!id) throw createError(401, "unauthorized")
        const books = await DB.collection("books").where("id", "==", id).get()
        if(books.empty) throw createError(404, "book not found")
        const bookData = books.docs.map((doc) => {
        /* 
          .first of all i will convert the created_at date coming in to milliseconds for a better time calculation
          . before moving further extract nanoseconds and seconds from the created_at field
          . then convert them all to milliseconds while considering that
          . 1000 ms -> 1s and 1 000 000 000ns -> 1ms
        */
          const created_at = (1000 * doc.data().created_at.seconds) + (1_000_000_000 * doc.data().created_at.nanoseconds) / 1000 
          return {
            id: doc.id,
            created_at,
            ...doc.data
          }
        })
        response.status(200).json(bookData)
    } catch (error) {
        throw createError(404, `something went wrong ${error}`)
    }
})

// retrieve books by pagination
export const retrievebooksbypagination = v2.https.onRequest(async (request: v2.https.Request, response) => {
    try {
        // retrieve the first 100 books
        const books = await DB.collection("books").limit(100).orderBy("created_at", "asc").get()
        if(books.empty) throw createError(404, "book not found")
        // get the last document to start paginating  
        const last = books.docs[books.docs.length - 1]
        // define the next page
        const next = await DB.collection("books").orderBy("created_at", "asc").startAfter(last.data().created_at).limit(100).get()
        // if there is no next page then return the last document
        if(next.empty) {
            const bookData = books.docs.map((doc) => {
                // convert the provided created_at values into milliseconds
                const created_at = (1000 * doc.data().created_at.seconds) + (1_000_000_000 * doc.data().created_at.nanoseconds) / 1000
                return {
                    id: doc.id,
                    created_at,
                    ...doc.data()
                }
            })
            response.status(200).json({previous: books, next: bookData})
        }

    } catch (error) {
        throw createError(404, `something went wrong ${error}`)
    }
})

// create a new book
export const createnewbook = v2.https.onRequest(async (request: v2.https.Request, response) => {
    try {
        const {created_at, author, title} = request.body as { created_at: string, author: string, title: string }
        if(!created_at || !author || !title) throw createError(401, "unauthorized")
        const addBook = await DB.collection("books").add({
            created_at: Timestamp.fromDate(new Date(created_at)),
            author,
            title
        })

        if(!addBook) response.status(201).json({success: false, message: "sorry the book is not created"})
        response.status(201).json({success: true, message: "book is created successfully"})
    } catch (error) {
        throw createError(404, "not found")
    }
})

// delete a book by id and name 
export const deletebook = v2.https.onRequest(async (request: v2.https.Request, response) => {
    try {
        const { id } = request.params as { id: string }
        if(!id) throw createError(401, "unauthorized")
        const book = await DB.collection("books").doc(id).delete()
        if(!book) throw createError(404, "book not found")
        response.status(200).json({success: true, message: "book is deleted successfully"})
    } catch (error) {
        throw createError(404, `something went wrong ${error}`)
    }
})

// update a book by id
export const updatebook = v2.https.onRequest(async (request: v2.https.Request, response) => {
    try {
        const  { id } = request.params as { id: string }
        const { title } = request.body as { title: string }

        if(!id || !title) throw createError(404, "Not found")
        // if all values are well provided then proceed on to the next level
        const books = await DB.collection("books").doc(id).update({title, created_at: Timestamp.fromDate(new Date())})
        if(!books) response.status(200).json({ success: false, message: "book is not updated"})
        response.status(200).json({ success: true, message: "book is successfully updated"})
    } catch (error) {
        throw createError(`something went wrong ${error}`)
    }
})

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
