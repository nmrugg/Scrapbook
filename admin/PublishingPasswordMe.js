
//r is for Read Caps, and it's simply like the username, the part before the '@'-sign in an unhosted address
//c is for Cloud, the domain name of the unhosted server
//n is RSA's name for the public key (e=0x10001). Ever heard of RSA being large primes multiplied? There you go: n=p*q.
//s is for session key. Again, RSA terminology. It's the access token you share to a groud of friends or subscribers
//w is for Write Caps, it's your (weakish) login password at the unhosted server where you have your account 'r@c'.
//d is RSA's name for the private key. d is such that d*e=1 in MOD (p-1)(q-1). The maths is done by Tom Wu's jsbn lib.
var PublishingPasswordMe = {
	"r":"7db31",
	"c":"example.unhosted.org",
	"n":"ddf563c24da318727b060307da3ace0c46e357c81d3137d79f2bf1125ec240980aa5d7aaa963a61028cb876416a181654ed6996cd9bb40449b0bd88eb8e42ce7",
	"s":"c6f7e7612b256f7a943fa45e72b56dcd",
	"w":"0249e",
	"d":"d058ddf1b00ade91e7a5370711f48d21bd10fe7f5bd7ad817b6a35fa76748547f2a70c61ec80a973426e183151c7ab37daa5f18cb24d6452753fecf032f1e671"};
