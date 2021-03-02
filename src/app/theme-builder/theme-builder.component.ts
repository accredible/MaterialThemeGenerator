import { Component, OnInit, ElementRef, NgZone } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';

import { debounceTime, take, switchMap } from 'rxjs/operators';

import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CreditsComponent } from '../credits/credits.component';
import { ThemeService, Theme } from '../theme.service';

import { highlight } from './highlight';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';


@Component({
  selector: 'app-theme-builder',
  templateUrl: './theme-builder.component.html',
  styleUrls: ['./theme-builder.component.scss']
})
export class ThemeBuilderComponent implements OnInit {

  form: FormGroup;

  refresh: Subject<number> = new Subject();
  ready: Subject<boolean> = new Subject();
  isReady: boolean;
  showingSource = false;
  source = '';
  css = '';
  sourcePretty: SafeHtml = '';
  first = true;

  constructor(private el: ElementRef, private zone: NgZone,
    private snackbar: MatSnackBar, private dialog: MatDialog,
    private sanitizer: DomSanitizer,
    public service: ThemeService
  ) {
    if (window.location.search) {
      setTimeout(() => {
        const theme = atob(decodeURIComponent(window.location.search.replace(/^[?]c=/, '')));
        this.service.fromExternal(theme);
      }, 100);
    }
  }

  onReady() {
    this.ready.next(true);
  }

  showSource(yes: boolean) {
    this.showingSource = yes;
  }

  showCredits() {
    this.dialog.open(CreditsComponent, {
      width: '500px',
    });
  }

  copy(title: string, val: string) {
    val = this._removeLinesFromString(val, 0, 9);
    const start = this._removeLinesFromString(this._getAngularSCSSBeginning(), 0, 1);
    const el = document.createElement('textarea');
    el.value = start + `${val}`;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    this.snackbar.open(`Successfully copied ${title} to clipboard!`, 'dismiss', {
      duration: 3000
    });
  }

  exportCSS() {
    this.copy('css', this.css);
  }

  exportSCSS() {
    this.copy('Angular scss', this.source);
  }

  makeLink() {
    const link = this._getUrlLink();
    this.copy('link', link);
  }

  ngOnInit() {
    this.ready
      .pipe(
        take(1),
        switchMap(x => this.service.$theme),
        debounceTime(100)
      )
      .subscribe(x => {
        this.updateTheme(x);
        setTimeout(() => this.isReady = true, 1000);
      });

    window.addEventListener('message', (ev) => {
      if (ev.data && ev.data.iconsDone) {
        console.log('Got It!', ev);
      }
    });
  }

  updateTheme(theme: Theme) {

    if (!theme.palette || !theme.fonts) {
      return;
    }

    this.source = this.service.getTemplate(theme);

    const iframe = (this.el.nativeElement as HTMLElement).querySelector('iframe');
    const body = iframe.contentDocument.body;

    this.sourcePretty = this.sanitizer.bypassSecurityTrustHtml(highlight(this.source));


    this.zone.runOutsideAngular(() => {
      this.service.compileScssTheme(this.source).then(text => {
        this.css = text;
        if (body.childNodes && body.childNodes.item(0) &&
          (body.childNodes.item(0) as HTMLElement).tagName &&
          (body.childNodes.item(0) as HTMLElement).tagName.toLowerCase() === 'style') {
          body.removeChild(body.childNodes.item(0));
        }

        const style = iframe.contentDocument.createElement('style');
        style.type = 'text/css';
        style.textContent = text;
        body.insertBefore(style, body.childNodes.item(0));
      }).catch(err => {
        console.error(err);
      });
    });
  }

  private _getUrlLink(): string {
    let link = window.location.toString().replace(/[#?].*$/g, '');
    link = `${link}?c=${btoa(this.service.toExternal())}`;
    return link;
  }

  private _getAngularSCSSBeginning(): string {
    return `
    /**
    * Generated theme by Material Theme Generator
    * ${this._getUrlLink()}
    **/

    @import \'../../../../node_modules/@angular/material/theming\';
    // Include the common styles for Angular Material. We include this here so that you only
    // have to load a single css file for Angular Material in your app.

    `;
  }

  private _removeLinesFromString(str, start = 0, end): string {
    // break the textblock into an array of lines
    const lines = str.split('\n');
    // remove one line, starting at the first position
    lines.splice(start, end);
    // join the array back into a single string
    return lines.join('\n');
  }
}

