interface IUser<U> {
    username: U;
    userId: U;
    email: U;
    password?: U;
}

export type { IUser }