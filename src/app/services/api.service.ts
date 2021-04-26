import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Plugins } from '@capacitor/core';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { tap, switchMap } from 'rxjs/operators'
const { Storage } = Plugins;
const ACCESS_TOKEN_KEY = 'my-access-token';
const REFRESH_TOKEN_KEY = 'my-refresh-token';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  //init with null to filter out the first value in guard
  isAuthenticated: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(null);
  currentAccessToken = null;
  url = environment.api_url;

  constructor(private http: HttpClient, private router: Router) {
    //when the app initialize
    this.loadToken();
   }

   //load accessToken on startup
   async loadToken(){
     const token = await Storage.get({key: ACCESS_TOKEN_KEY });
     if(token && token.value) {
       this.currentAccessToken = token.value;
       this.isAuthenticated.next(true);
     }else {
       this.isAuthenticated.next(false);
     }
   }

   //get secret protected data
   getSecretData() {
     return this.http.get(`${this.url}/users/secret`);
   }

   //create users
   signUp(credentials: {username, password}): Observable<any> {
     return this.http.post(`${this.url}/users`, credentials);
   }

   //sign in a user and store access and refresh token
   login(credentials: {username, password}): Observable<any> {
     return this.http.post(`${this.url}/auth`, credentials).pipe(
       switchMap((tokens: { accessToken, refreshToken }) => {
         this.currentAccessToken = tokens.accessToken;
         const storeAccess = Storage.set({key: ACCESS_TOKEN_KEY, value: tokens.accessToken });
         const storeRefresh = Storage.set({ key: REFRESH_TOKEN_KEY, value: tokens.refreshToken });
         return from(Promise.all([storeAccess, storeRefresh]));
       }),
       tap(_ => {
         this.isAuthenticated.next(true);
       })
     )
   }

   //potentially perform a logout operation inside API
   // simply just remove all local tokens and navigate to login
   logout() {
     return this.http.post(`${this.url}/auth/logout`, {}).pipe(
       switchMap(_=> {
         this.currentAccessToken = null;
         //remove all stored tokens
         const deleteAccess = Storage.remove({key: ACCESS_TOKEN_KEY});
         const deleteRefresher = Storage.remove({key: REFRESH_TOKEN_KEY});
         return from (Promise.all([deleteAccess, deleteRefresher]));
       }),
       tap(_ => {
         this.isAuthenticated.next(false);
         this.router.navigateByUrl('/', { replaceUrl: true });
       })
     ).subscribe();
   }

   //load the refresher token from storage
   //then attach it as the header for one spesific API call
   getNewAccessToken() {
     const refreshToken = from(Storage.get({key: REFRESH_TOKEN_KEY}));
     return refreshToken.pipe(
       switchMap(token => {

         if(token && token.value) {
           const httpOptions = {
             headers: new HttpHeaders({
               'Content-Type': 'application/json',
               Authorization: `Bearer ${token.value}`
             })
           }
           return this.http.get(`${this.url}/auth.refresh`, httpOptions);
         } else {
           //no stored refresh token
           return of(null);
         }
        
       })
     )
   }

   //store new Access Token
   storeAccessToken(accessToken) {
     this.currentAccessToken = accessToken;
     return from(Storage.set({ key: ACCESS_TOKEN_KEY, value: accessToken}))
   }


}
