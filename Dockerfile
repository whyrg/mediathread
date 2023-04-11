FROM node:16-alpine3.16 as node
WORKDIR /app
COPY . /app/
RUN rm -rf node_modules; npm install; npm run build 


FROM ccnmtl/django.base
RUN apt-get update \
 && apt-get install python3-urllib3 -y
ADD requirements /requirements
ADD wheelhouse /wheelhouse
RUN /ve/bin/pip install --no-index -f /wheelhouse -r /wheelhouse/requirements.txt \
&& rm -rf /wheelhouse
WORKDIR /app
COPY . /app/
COPY --from=node /app/media/js/bundle.js /app/media/js/bundle.js
#RUN /ve/bin/python manage.py test
EXPOSE 8000
ADD docker-run.sh /run.sh
# ENV APP mediathread
ENTRYPOINT ["/run.sh"]
CMD ["run"]
