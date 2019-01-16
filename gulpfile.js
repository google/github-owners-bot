/**
 * Copyright 2016 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var $$ = require('gulp-load-plugins')();
const gulp = require('gulp');
const del = require('del');
const argv = require('minimist')(process.argv.slice(2));

const sources = ['{app,config}.js', '{src,routes}/**/*.js'];

const tests = ['tests/**/{test,test-*}.js'];

gulp.task('default', ['lint', 'babel']);

gulp.task('babel', () => {
  return gulp.src(sources)
    .pipe($$.babel())
    .pipe(gulp.dest('dist'));
});

gulp.task('test', () => {
  return gulp.src(tests).pipe($$.ava({verbose: true, timeout: '15s'}));
});

gulp.task('lint', () => {
  return gulp.src(sources)
      .pipe($$.eslint())
      .pipe($$.eslint.format());
});

gulp.task('clean', (done) => {
  return del(['dist'], done);
});

gulp.task('watch', (done) => {
  return gulp.watch(sources, {ignoreInitial: false}, () => {
    gulp.start('default', done);
  });
});

gulp.task('watch:test', (done) => {
  return gulp.watch(tests.concat(sources), {ignoreInitial: false}, () => {
    gulp.start('test', done);
  });
});
