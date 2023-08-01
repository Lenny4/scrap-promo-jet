FROM dorowu/ubuntu-desktop-lxde-vnc:bionic AS app_node

# doesn't work with node version > 14
# region Node https://github.com/nodesource/distributions/blob/master/README.md#using-ubuntu
RUN curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash - &&\
    apt-get -y update \
	&& apt-get upgrade -y \
	&& apt-get install -y curl gpg-agent nano nodejs

RUN echo "cd /srv/app" >> /root/.bashrc

RUN chmod -R 777 /root/.cache

WORKDIR /srv/app

