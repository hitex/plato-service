# Plato Service

## Installation:

```
npm install
bower install
node .
```

## Configuration:

Add `.platoservicerc` file in the root of the project or in any places defined [here](https://www.npmjs.com/package/rc#standards)

``` json
{
    "tmp": "tmp",
    "resultDir": "results",
    "host": "localhost",
    "port": 3000,
    "providers": {
        "github.com": {
            "zipUrl": "https://github.com/{user}/{repo}/archive/{branch}.zip"
        },
        "bitbucket.com": {
            "zipUrl": "https://bitbucket.org/{user}/{repo}/get/{branch}.zip"
        }
    }
}
```

## API

### Start a new task

`GET /api/task/{provider}/{user}/{repo}`

Query params:

* `dir` - js source directory in given repository (default: /)
* `branch` - branch name (default: master)
    
* `provider` - repository provider (e.g. github.com)
* `user` - repository owner (e.g. hitex)
* `repo` - repository name (e.g. plato-service)

e.g. `GET /api/task/github.com/hitex/plato-service?dir=src&branch=master`
