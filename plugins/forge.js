dashboard.forge = function(repo) {
  var r = repositories[repo.name]['repo'];
  r.contents('master', 'metadata.json', function(err, contents) {
    if (err) {
      r.contents('master', 'Modulefile', function(err, contents) {
        if (err) {
          // This might be a warning/error at some point
          updateCell(repo.name, 'forge', '');
        } else {
          parseModulefile(repo, contents);
        }
      }, false);
    } else {
      parseMetadataJSON(repo, contents);
    }
  });
};

function parseMetadataJSON(repo, contents) {
  var json = JSON.parse(contents);
  var module = json.name;
  updateForge(repo, module);
}

function parseModulefile(repo, contents) {
  var matches = contents.match(/name\s+(?:["'])([^"']+)(?:["\'])/);
  var module = matches[1];
  updateForge(repo, module);
}

function updateForge(repo, module) {
  var m = module.split('-');
  // forge.puppetlabs.com doesn't allow CORS, use a proxy
  if (m[0] == account) {
    forgeAPICall('/users/'+m[0]+'/modules/'+m[1]+'/releases/find.json', true, function(err, res) {
      if (err) {
        updateForgeCell(repo.name, 'ERR', 'warn', '4');
      } else {
        checkForgeTags(repo, res.version, 'http://forge.puppetlabs.com'+res.file);
      }
    });
  } else {
    updateForgeCell(repo.name, '', 'ok', '1');
  }
};

function checkForgeTags(repo, version, url) {
  // Check if there is a tag for the release
  var r = repositories[repo.name]['repo'];
  var html = '<a href="'+url+'">'+version+'</a>';
  r.listTags(function(err, tags) {
    if (err) {
      html += ' <a href="'+repo.tags_url+'" title="Failed to get tags"><i class="fa fa-warning"></i></a>';
      updateForgeCell(repo.name, html, 'warn', '3');
    } else {
      var tag_url = versionTagURL(tags, version);
      if (tag_url) {
        checkForgeTagsCommits(repo, version, url, tag_url);
      } else {
        // No tag found, it's a warning
        html += ' <a href="'+repo.tags_url+'" title="No matching tag found in repository"><i class="fa fa-warning"></i></a>';
        updateForgeCell(repo.name, html, 'warn', '2');
      }
    }
  });
}

function checkForgeTagsCommits(repo, version, url, tag_url) {
  var html = '<a href="'+url+'">'+version+'</a>';
  html += ' <a href="'+tag_url+'" title="Matching tag found in repository"><i class="fa fa-tag"></i></a>';
  updateForgeCell(repo.name, html, 'ok', '0');
}

function updateForgeCell(name, html, state, customkey) {
  updateCell(name, 'forge', html, state, customkey);
}

function versionTagURL(tags, version) {
  for (var i=0; i<tags.length; i++) {
    if (tags[i].name == version) {
      return tags[i].commit.url;
    }
  }
}

function forgeAPICall(path, use_corsproxy, cb) {
  function getURL() {
    if (use_corsproxy) {
      return 'http://www.corsproxy.com/forge.puppetlabs.com'+path+'?'+ (new Date()).getTime();
    } else {
      return 'http://forge.puppetlabs.com'+path+'?'+ (new Date()).getTime();
    }
  }

  var xhr = new XMLHttpRequest();
  
  xhr.open('GET', getURL(), true);
  xhr.onreadystatechange = function () {
    if (this.readyState == 4) {
      if (this.status >= 200 && this.status < 300 || this.status === 304) {
        cb(null, this.responseText ? JSON.parse(this.responseText) : true, this);
      } else {
        cb({path: path, request: this, error: this.status});
      }
    }
  };
  xhr.setRequestHeader('Content-Type','application/json;charset=UTF-8');
  xhr.send();
};
