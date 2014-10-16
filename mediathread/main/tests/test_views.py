# pylint: disable-msg=R0904
# pylint: disable-msg=E1103
from datetime import datetime
import json

from courseaffils.models import Course
from django.conf import settings
from django.contrib.auth.models import User, AnonymousUser
from django.core import mail
from django.http.response import Http404
from django.test import TestCase
from django.test.client import Client, RequestFactory

from mediathread.assetmgr.models import Asset
from mediathread.factories import UserFactory, MediathreadTestMixin, \
    AssetFactory, ProjectFactory, SherdNoteFactory
from mediathread.main.forms import ContactUsForm, RequestCourseForm
from mediathread.main.views import MigrateCourseView, ContactUsView, \
    RequestCourseView
from mediathread.projects.models import Project


class SimpleViewTest(TestCase):
    def setUp(self):
        self.client = Client()

    def test_index(self):
        # it should redirect us somewhere.
        response = self.client.get("/")
        self.assertEquals(response.status_code, 302)
        # for now, we don't care where. really, we
        # are just making sure it's not a 500 error
        # at this point

    def test_smoke(self):
        # run the smoketests. we don't care if they pass
        # or fail, we just want to make sure that the
        # smoketests themselves don't have an error
        response = self.client.get("/smoketest/")
        self.assertEquals(response.status_code, 200)


class MigrateCourseViewTest(MediathreadTestMixin, TestCase):

    def setUp(self):
        self.factory = RequestFactory()

        self.setup_sample_course()
        self.setup_alternate_course()

        self.superuser = User.objects.create(username='ccnmtl',
                                             password='test',
                                             is_superuser=True,
                                             is_staff=True)

        # instructor that sees both Sample Course & Alternate Course
        self.instructor_three = UserFactory(username='instructor_three')
        self.add_as_faculty(self.sample_course, self.instructor_three)
        self.add_as_faculty(self.alt_course, self.instructor_three)

        self.sample_course = Course.objects.get(title='Sample Course')
        self.alt_course = Course.objects.get(title="Alternate Course")

        self.asset1 = AssetFactory.create(course=self.sample_course,
                                          primary_source='image')

        self.student_note = SherdNoteFactory(
            asset=self.asset1, author=self.student_one,
            tags=',student_one_selection',
            body='student one selection note', range1=0, range2=1)
        self.instructor_note = SherdNoteFactory(
            asset=self.asset1, author=self.instructor_one,
            tags=',image, instructor_one_selection,',
            body='instructor one selection note', range1=0, range2=1)
        self.instructor_ga = SherdNoteFactory(
            asset=self.asset1, author=self.instructor_one,
            tags=',image, instructor_one_global,',
            body='instructor one global note',
            title=None, range1=None, range2=None)
        self.instructor_two_ga = SherdNoteFactory(
            asset=self.asset1, author=self.instructor_two,
            tags=',instructor_two_global,',
            body='instructor two global note',
            title=None, range1=None, range2=None)

    def test_as_student(self):
        self.assertTrue(
            self.client.login(username=self.student_one.username,
                              password='test'))
        response = self.client.get('/dashboard/migrate/')
        self.assertEquals(response.status_code, 403)

    def test_not_logged_in(self):
        response = self.client.get('/dashboard/migrate/')
        self.assertEquals(response.status_code, 302)

    def test_get_context_data(self):
        request = RequestFactory().get('/dashboard/migrate/')
        request.user = self.instructor_three
        request.course = self.sample_course

        view = MigrateCourseView()
        view.request = request

        ctx = view.get_context_data()

        self.assertEquals(len(ctx['current_course_faculty']), 3)
        self.assertEquals(ctx['current_course_faculty'][0].username,
                          'instructor_one')
        self.assertEquals(ctx['current_course_faculty'][1].username,
                          'instructor_two')
        self.assertEquals(ctx['current_course_faculty'][2].username,
                          'instructor_three')

        self.assertEquals(len(ctx['available_courses']), 2)
        self.assertEquals(ctx['available_courses'][0].title,
                          'Alternate Course')
        self.assertEquals(ctx['available_courses'][1].title,
                          'Sample Course')

        request.user = self.superuser
        ctx = view.get_context_data()
        self.assertEquals(len(ctx['available_courses']), 2)
        self.assertEquals(ctx['available_courses'][0].title,
                          'Alternate Course')
        self.assertEquals(ctx['available_courses'][1].title,
                          'Sample Course')

    def test_post_invalidcourse(self):
        data = {'fromCourse': 42}

        request = RequestFactory().post('/dashboard/migrate/', data)
        request.user = self.superuser
        request.course = self.sample_course

        view = MigrateCourseView()
        view.request = request

        self.assertRaises(Http404, view.post, request)

    def test_post_on_behalf_of_student(self):
        data = {
            'fromCourse': self.alt_course.id,
            'on_behalf_of': self.alt_student.id
        }

        request = RequestFactory().post('/dashboard/migrate/', data)
        request.user = self.superuser
        request.course = self.sample_course

        view = MigrateCourseView()
        view.request = request
        response = view.post(request)

        the_json = json.loads(response.content)
        self.assertFalse(the_json['success'])

    def test_post_on_behalf_of_faculty(self):
        data = {
            'fromCourse': self.alt_course.id,
            'on_behalf_of': self.alt_instructor.id
        }

        request = RequestFactory().post('/dashboard/migrate/', data)
        request.user = self.superuser
        request.course = self.sample_course

        view = MigrateCourseView()
        view.request = request
        response = view.post(request)

        the_json = json.loads(response.content)
        self.assertFalse(the_json['success'])

    def test_migrate_asset(self):
        data = {'fromCourse': self.sample_course.id,
                'asset_ids[]': [self.asset1.id],
                'project_ids[]': []}

        # Migrate assets from SampleCourse into Alternate Course
        # test_instructor_three is a member of both courses
        request = RequestFactory().post('/dashboard/migrate/', data)
        request.user = self.instructor_three
        request.course = self.alt_course

        view = MigrateCourseView()
        view.request = request
        response = view.post(request)

        the_json = json.loads(response.content)
        self.assertTrue(the_json['success'])
        self.assertEquals(the_json['asset_count'], 1)
        self.assertEquals(the_json['project_count'], 0)
        self.assertEquals(the_json['note_count'], 3)

        new_asset = Asset.objects.get(course=self.alt_course,
                                      title=self.asset1.title)
        self.assertEquals(new_asset.sherdnote_set.count(), 2)
        new_note = new_asset.sherdnote_set.all()[0]
        self.assertEquals(new_note.author, self.instructor_three)
        self.assertEquals(new_note.title, self.instructor_note.title)
        self.assertEquals(new_note.tags, '')
        self.assertIsNone(new_note.body)
        self.assertFalse(new_note.is_global_annotation())

        new_note = new_asset.sherdnote_set.all()[1]
        self.assertEquals(new_note.author, self.instructor_three)
        self.assertIsNone(new_note.title)
        self.assertEquals(new_note.tags, '')
        self.assertIsNone(new_note.body)
        self.assertTrue(new_note.is_global_annotation())

    def test_migrate_with_tags(self):
        data = {
            'fromCourse': self.sample_course.id,
            'asset_ids[]': [self.asset1.id],
            'project_ids[]': [],
            'include_tags': 'true',
            'include_notes': 'false'
        }

        # Migrate assets from SampleCourse into Alternate Course
        # test_instructor_three is a member of both courses
        request = RequestFactory().post('/dashboard/migrate/', data)
        request.user = self.instructor_three
        request.course = self.alt_course

        view = MigrateCourseView()
        view.request = request
        view.post(request)

        new_asset = Asset.objects.get(course=self.alt_course,
                                      title=self.asset1.title)
        self.assertEquals(new_asset.sherdnote_set.count(), 2)
        new_note = new_asset.sherdnote_set.all()[0]
        self.assertEquals(new_note.tags, self.instructor_note.tags)
        self.assertIsNone(new_note.body)

        new_note = new_asset.sherdnote_set.all()[1]
        self.assertEquals(
            new_note.tags,
            u',image, instructor_one_global,,instructor_two_global,')
        self.assertIsNone(new_note.body)

    def test_migrate_with_notes(self):
        data = {
            'fromCourse': self.sample_course.id,
            'asset_ids[]': [self.asset1.id],
            'project_ids[]': [],
            'include_tags': 'false',
            'include_notes': 'true',
        }

        # Migrate assets from SampleCourse into Alternate Course
        # test_instructor_three is a member of both courses
        request = RequestFactory().post('/dashboard/migrate/', data)
        request.user = self.instructor_three
        request.course = self.alt_course

        view = MigrateCourseView()
        view.request = request
        view.post(request)

        new_asset = Asset.objects.get(course=self.alt_course,
                                      title=self.asset1.title)
        self.assertEquals(new_asset.sherdnote_set.count(), 2)
        new_note = new_asset.sherdnote_set.all()[0]
        self.assertEquals(new_note.tags, '')
        self.assertEquals(new_note.body, self.instructor_note.body)

        new_note = new_asset.sherdnote_set.all()[1]
        self.assertEquals(new_note.tags, '')
        self.assertEquals(
            new_note.body,
            u'instructor one global noteinstructor two global note')

    def test_migrate_tags_and_notes(self):
        data = {
            'fromCourse': self.sample_course.id,
            'asset_ids[]': [self.asset1.id],
            'project_ids[]': [],
            'include_tags': 'true',
            'include_notes': 'true'
        }

        # Migrate assets from SampleCourse into Alternate Course
        # test_instructor_three is a member of both courses
        request = RequestFactory().post('/dashboard/migrate/', data)
        request.user = self.instructor_three
        request.course = self.alt_course

        view = MigrateCourseView()
        view.request = request
        view.post(request)

        new_asset = Asset.objects.get(course=self.alt_course,
                                      title=self.asset1.title)
        self.assertEquals(new_asset.sherdnote_set.count(), 2)
        new_note = new_asset.sherdnote_set.all()[0]
        self.assertEquals(new_note.tags, self.instructor_note.tags)
        self.assertEquals(new_note.body, self.instructor_note.body)

        new_note = new_asset.sherdnote_set.all()[1]
        self.assertEquals(
            new_note.tags,
            u',image, instructor_one_global,,instructor_two_global,')
        self.assertEquals(
            new_note.body,
            u'instructor one global noteinstructor two global note')

    def test_migrate_project(self):
        self.project1 = ProjectFactory.create(course=self.sample_course,
                                              author=self.instructor_one,
                                              policy='PublicEditorsAreOwners')

        self.add_citation(self.project1, self.instructor_note)
        self.add_citation(self.project1, self.student_note)
        self.assertEquals(len(self.project1.citations()), 2)

        data = {
            'fromCourse': self.sample_course.id,
            'asset_ids[]': [],
            'project_ids[]': [self.project1.id]
        }

        # Migrate assets from SampleCourse into Alternate Course
        # test_instructor_three is a member of both courses
        request = RequestFactory().post('/dashboard/migrate/', data)
        request.user = self.instructor_three
        request.course = self.alt_course

        view = MigrateCourseView()
        view.request = request
        response = view.post(request)

        the_json = json.loads(response.content)
        self.assertTrue(the_json['success'])
        self.assertEquals(the_json['asset_count'], 1)
        self.assertEquals(the_json['project_count'], 1)
        self.assertEquals(the_json['note_count'], 2)

        new_asset = Asset.objects.get(course=self.alt_course,
                                      title=self.asset1.title)
        self.assertEquals(new_asset.sherdnote_set.count(), 3)

        new_note = new_asset.sherdnote_set.get(title=self.student_note.title)
        self.assertEquals(new_note.author, self.instructor_three)

        new_note = new_asset.sherdnote_set.get(
            title=self.instructor_note.title)
        self.assertEquals(new_note.author, self.instructor_three)

        new_note = new_asset.sherdnote_set.get(title=None)
        self.assertEquals(new_note.author, self.instructor_three)
        self.assertTrue(new_note.is_global_annotation())

        new_project = Project.objects.get(
            course=self.alt_course, title=self.project1.title)
        self.assertEquals(len(new_project.citations()), 2)

    def test_migrate_materials_view_student(self):
        self.assertTrue(self.client.login(username=self.student_one.username,
                                          password="test"))

        response = self.client.get('/dashboard/migrate/materials/%s/' %
                                   self.sample_course.id, {},
                                   HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEquals(response.status_code, 403)

    def test_migrate_materials_sample_course(self):
        self.project1 = ProjectFactory.create(course=self.sample_course,
                                              author=self.instructor_one,
                                              policy='PrivateEditorsAreOwners')
        self.project2 = ProjectFactory.create(course=self.sample_course,
                                              author=self.instructor_one,
                                              policy='Assignment')

        self.assertTrue(self.client.login(
            username=self.instructor_three.username,
            password="test"))

        set_course_url = '/?set_course=%s&next=/' % \
            self.sample_course.group.name
        response = self.client.get(set_course_url, follow=True)
        self.assertEquals(response.status_code, 200)

        url = '/dashboard/migrate/materials/%s/' % self.sample_course.id

        response = self.client.get(url, {},
                                   HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEquals(response.status_code, 200)

        the_json = json.loads(response.content)
        self.assertEquals(the_json['course']['title'], 'Sample Course')
        self.assertEquals(len(the_json['assets']), 1)

        self.assertEquals(the_json['assets'][0]['title'],
                          self.asset1.title)
        self.assertEquals(the_json['assets'][0]['annotation_count'], 1)

        self.assertEquals(len(the_json['projects']), 1)
        self.assertEquals(the_json['projects'][0]['title'],
                          self.project2.title)

    def test_migrate_materials_alternate_course(self):
        self.assertTrue(self.client.login(
            username=self.instructor_three.username,
            password="test"))
        set_course_url = '/?set_course=%s&next=/' % \
            self.alt_course.group.name
        response = self.client.get(set_course_url, follow=True)
        self.assertEquals(response.status_code, 200)

        url = '/dashboard/migrate/materials/%s/' % self.alt_course.id

        response = self.client.get(url, {},
                                   HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEquals(response.status_code, 200)

        the_json = json.loads(response.content)
        self.assertEquals(the_json['course']['title'], 'Alternate Course')
        self.assertEquals(len(the_json['assets']), 0)
        self.assertEquals(len(the_json['projects']), 0)


class ContactUsViewTest(TestCase):

    def test_get_initial_anonymous(self):
        view = ContactUsView()
        view.request = RequestFactory().get('/contact/')
        view.request.user = AnonymousUser()
        view.get_initial()

        self.assertIsNotNone(view.initial['issue_date'])
        self.assertFalse('name' in view.initial)
        self.assertFalse('email' in view.initial)
        self.assertFalse('username' in view.initial)

    def test_get_initial_not_anonymous(self):
        view = ContactUsView()
        view.request = RequestFactory().get('/contact/')
        view.request.user = UserFactory(first_name='Foo',
                                        last_name='Bar',
                                        email='foo@bar.com')

        view.get_initial()

        self.assertIsNotNone(view.initial['issue_date'])
        self.assertEquals(view.initial['name'], 'Foo Bar')
        self.assertEquals(view.initial['email'], 'foo@bar.com')
        self.assertEquals(view.initial['username'], view.request.user.username)

    def test_form_valid(self):
        view = ContactUsView()
        form = ContactUsForm()
        form.cleaned_data = {
            'issuer_date': datetime.now(),
            'name': 'Linus Torvalds',
            'username': 'ltorvalds',
            'email': 'sender@ccnmtl.columbia.edu',
            'course': 'Introduction to Linux',
            'category': 'View Image',
            'description': 'This is a problem'
        }

        with self.settings(SUPPORT_DESTINATION='support@ccnmtl.columbia.edu'):
            view.form_valid(form)
            self.assertEqual(len(mail.outbox), 1)

            self.assertEqual(mail.outbox[0].subject,
                             'Mediathread Contact Us Request')
            self.assertEquals(mail.outbox[0].from_email,    
                              'sender@ccnmtl.columbia.edu')
            self.assertEquals(mail.outbox[0].to,
                              [settings.SUPPORT_DESTINATION])


class RequestCourseViewTest(TestCase):

    def test_form_valid(self):
        view = RequestCourseView()
        form = RequestCourseForm()
        form.cleaned_data = {
            'name': 'Test Instructor',
            'email': 'test_instructor@ccnmtl.columbia.edu',
            'uni': 'ttt123',
            'course': 'Test Course',
            'course_id': 'Test Course Id',
            'term': 'Fall',
            'year': '2014',
            'instructor': 'Test Instructor',
            'section_leader': 'Test Teachers Assistant',
            'start': datetime.now(),
            'end': datetime.now(),
            'students': 24,
            'assignments_required': True,
            'description': 'Description',
            'title': 'The Course',
            'pid': '123',
            'mid': '456',
            'type': 'action item',
            'owner': 'sdreher',
            'assigned_to': 'sdreher'
        }

        with self.settings(TASK_ASSIGNMENT_DESTINATION=None):
            view.form_valid(form)
