# Plato Service

##Installation:

```
npm install
bower install
node .
```

##Configuration:

Add .platoservicerc file in the root of the project or in any places defined here: https://www.npmjs.com/package/rc#standards

```
{
    tmp: 'tmp',
    resultDir: 'results',
    host: 'localhost',
    port: 3000,
    providers: {
        'github.com': {
            zipUrl: 'https://github.com/{user}/{repo}/archive/{branch}.zip'
        },
        'bitbucket.com': {
            zipUrl: 'https://bitbucket.org/{user}/{repo}/get/{branch}.zip'
        }
    }
}
```
