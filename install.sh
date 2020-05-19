echo 'installing requirements'

apt-get update
echo 'installing curl'
apt install curl

echo 'installing youtube-dl'
sudo curl -L https://yt-dl.org/downloads/latest/youtube-dl -o /usr/local/bin/youtube-dl
sudo chmod a+rx /usr/local/bin/youtube-dl
echo 'done installing youtube-dl'

echo 'installing node.js'
sudo curl -sL https://deb.nodesource.com/setup_13.x | bash -
sudo apt-get install -y nodejs
echo 'done installing node.js'

echo 'installing node_modules'
sudo npm install
echo 'done installing node_modules'

echo 'done with installation'